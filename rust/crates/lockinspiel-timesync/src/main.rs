use std::{
    io::Read,
    net::TcpListener,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use lockinspiel_timesync::ResponseBuffer;

fn main() {
    let tcp_socket = TcpListener::bind(
        std::env::var("LISTEN_ADDR")
            .as_ref()
            .map_or("[::]:2342", |f| f.as_str()),
    )
    .unwrap();
    std::thread::scope(|s| {
        for _ in 0..std::thread::available_parallelism().unwrap().get() * 2 {
            s.spawn(|| {
                let mut response_buffer = ResponseBuffer::new();
                let mut buf = [0u8; 2048]; // stack allocated, sized for typical HTTP request
                loop {
                    let (mut socket, _) = tcp_socket.accept().unwrap();

                    socket.set_nodelay(true).unwrap();
                    socket
                        .set_read_timeout(Some(Duration::from_secs(5)))
                        .unwrap();

                    // let _ = socket.read(&mut [0; "GET / HTTP/1.1\r\n".len()]);

                    let mut total = 0;
                    loop {
                        let n = match socket.read(&mut buf[total..]) {
                            Ok(0) => break, // connection closed
                            Ok(n) => n,
                            Err(_) => break, // timeout or other error
                        };
                        total += n;
                        if total >= 4 && &buf[total - 4..total] == b"\r\n\r\n" {
                            break;
                        }
                    }
                    let t1 = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_micros();
                    // let t1 = 1779133538995977;
                    response_buffer.response(t1, &mut socket);
                }
            });
        }
    });
}
