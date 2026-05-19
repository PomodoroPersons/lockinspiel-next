use std::{
    io::{self, IoSlice, Write},
    time::{SystemTime, UNIX_EPOCH},
};

const RESPONSE_CLOSE: &str = "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: ";
const RESPONSE_KEEP_ALIVE: &str = "HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nContent-Length: ";

pub struct ResponseBuffer {
    t1_buffer: itoa::Buffer,
    t2_buffer: itoa::Buffer,
    content_length_buffer: itoa::Buffer,
}

impl ResponseBuffer {
    pub fn new() -> Self {
        let t1_buffer = itoa::Buffer::new();
        let t2_buffer = itoa::Buffer::new();
        let content_length_buffer = itoa::Buffer::new();

        Self {
            t1_buffer,
            t2_buffer,
            content_length_buffer,
        }
    }

    pub fn response<W: Write>(&mut self, t1: u128, writer: &mut W) -> io::Result<()> {
        self.response_inner(t1, writer, RESPONSE_CLOSE)
    }

    pub fn response_keep_alive<W: Write>(&mut self, t1: u128, writer: &mut W) -> io::Result<()> {
        self.response_inner(t1, writer, RESPONSE_KEEP_ALIVE)
    }

    fn response_inner<W: Write>(
        &mut self,
        t1: u128,
        writer: &mut W,
        header: &str,
    ) -> io::Result<()> {
        let t1_str = self.t1_buffer.format(t1);
        let t2 = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros();
        let t2_str = self.t2_buffer.format(t2);
        let content_length = self
            .content_length_buffer
            .format(t1_str.len() + t2_str.len() + 1);

        let mut slices = [
            IoSlice::new(header.as_bytes()),
            IoSlice::new(content_length.as_bytes()),
            IoSlice::new(b"\r\n\r\n"),
            IoSlice::new(t1_str.as_bytes()),
            IoSlice::new(b"\n"),
            IoSlice::new(t2_str.as_bytes()),
        ];
        let mut slices = slices.as_mut_slice();
        // From https://doc.rust-lang.org/src/std/io/mod.rs.html#1937-1952
        // until this is stable
        IoSlice::advance_slices(&mut slices, 0);
        while !slices.is_empty() {
            match writer.write_vectored(slices) {
                Ok(0) => {
                    return Err(io::Error::new(
                        io::ErrorKind::WriteZero,
                        "failed to write whole buffer",
                    ));
                }
                Ok(n) => IoSlice::advance_slices(&mut slices, n),
                Err(ref e) if e.kind() == io::ErrorKind::Interrupted => {}
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }
}
