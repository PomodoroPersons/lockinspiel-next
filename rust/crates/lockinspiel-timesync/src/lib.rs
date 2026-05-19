use std::{
    io::{IoSlice, Write},
    time::{SystemTime, UNIX_EPOCH},
};

const RESPONSE: &'static str = "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: ";

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

    pub fn response<W: Write>(&mut self, t1: u128, writer: &mut W) {
        let t1_str = self.t1_buffer.format(t1);
        let t2 = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros();
        // let t2: u128 = 1779129793217117;
        let t2_str = self.t2_buffer.format(t2);
        let content_length = self
            .content_length_buffer
            .format(t1_str.len() + t2_str.len() + 1);

        let _ = writer.write_vectored(&[
            IoSlice::new(RESPONSE.as_bytes()),
            IoSlice::new(content_length.as_bytes()),
            IoSlice::new(b"\r\n\r\n"),
            IoSlice::new(t1_str.as_bytes()),
            IoSlice::new(b"\n"),
            IoSlice::new(t2_str.as_bytes()),
        ]);
    }
}
