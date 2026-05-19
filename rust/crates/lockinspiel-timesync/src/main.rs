use std::{
    io::{self, Read},
    mem::ManuallyDrop,
    ops::DerefMut,
    os::fd::{AsRawFd, FromRawFd},
    time::{SystemTime, UNIX_EPOCH},
};

use lockinspiel_timesync::ResponseBuffer;
use mio::{Events, Interest, Poll, Token, net::TcpListener};
use slab::Slab;

const SERVER: Token = Token(usize::MAX);

struct Connection {
    buf: [u8; 2048],
    socket: mio::net::TcpStream,
    total: usize,
}

fn main() {
    let raw_fd = ManuallyDrop::new(
        TcpListener::bind(
            std::env::var("LISTEN_ADDR")
                .as_ref()
                .map_or("[::]:2342", |f| f.as_str())
                .parse()
                .unwrap(),
        )
        .unwrap(),
    )
    .as_raw_fd();

    std::thread::scope(|s| {
        for _ in 0..std::thread::available_parallelism().unwrap().get() * 2 {
            s.spawn(|| {
                let mut poll = Poll::new().unwrap();
                let mut events = Events::with_capacity(1024);
                let mut tcp_socket = unsafe { ManuallyDrop::new(TcpListener::from_raw_fd(raw_fd)) };
                poll.registry()
                    .register(tcp_socket.deref_mut(), SERVER, Interest::READABLE)
                    .unwrap();

                let mut response_buffer = ResponseBuffer::new();
                let mut connections: Slab<Connection> = Slab::new();

                loop {
                    if let Err(err) = poll.poll(&mut events, None) {
                        if err.kind() == io::ErrorKind::Interrupted {
                            continue;
                        }
                        panic!("{:?}", err);
                    }

                    for event in events.iter() {
                        match event.token() {
                            SERVER => accept_connections(&tcp_socket, &mut poll, &mut connections)
                                .unwrap(),
                            token => {
                                if let Some(conn) = connections.get_mut(token.0) {
                                    if event.is_readable()
                                        && handle_readable(conn, &mut response_buffer).unwrap()
                                    {
                                        poll.registry().deregister(&mut conn.socket).unwrap();
                                    }
                                    if event.is_writable() {
                                        poll.registry()
                                            .reregister(&mut conn.socket, token, Interest::READABLE)
                                            .unwrap();
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    });

    unsafe { TcpListener::from_raw_fd(raw_fd) };
}

fn accept_connections(
    tcp_socket: &ManuallyDrop<TcpListener>,
    poll: &mut Poll,
    connections: &mut Slab<Connection>,
) -> io::Result<()> {
    loop {
        let (mut socket, _) = match tcp_socket.accept() {
            Ok(conn) => conn,
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => break,
            Err(e) => return Err(e),
        };
        socket.set_nodelay(true)?;

        let entry = connections.vacant_entry();
        let token = Token(entry.key());
        poll.registry()
            .register(&mut socket, token, Interest::READABLE)?;
        entry.insert(Connection {
            socket,
            buf: [0u8; 2048],
            total: 0,
        });
    }
    Ok(())
}

fn handle_readable(
    conn: &mut Connection,
    response_buffer: &mut ResponseBuffer,
) -> io::Result<bool> {
    let mut connection_closed = false;

    loop {
        match conn.socket.read(&mut conn.buf[conn.total..]) {
            Ok(0) => {
                connection_closed = true;
                break;
            }
            Ok(n) => {
                conn.total += n;
                if conn.total >= 4 && &conn.buf[conn.total - 4..conn.total] == b"\r\n\r\n" {
                    let t1 = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_micros();
                    match response_buffer.response_keep_alive(t1, &mut conn.socket) {
                        Ok(_) => {}
                        Err(ref err) if err.kind() == io::ErrorKind::WouldBlock => {}
                        Err(e) => return Err(e),
                    }
                    conn.total = 0;
                    return Ok(false);
                }
                if conn.total >= conn.buf.len() {
                    conn.total = 0;
                    return Ok(false);
                }
            }
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => break,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }

    Ok(connection_closed)
}
