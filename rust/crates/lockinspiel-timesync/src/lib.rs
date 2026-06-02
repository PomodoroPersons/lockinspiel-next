use std::{
    io::{self, IoSlice, Write},
    time::{SystemTime, UNIX_EPOCH},
};

const HTTP_HEADER: &str = "HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nContent-Length: ";

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
        let json_header = r#"{"n2":"#;
        let json_separator = r#","n3":"#;
        let json_footer = r#"}"#;
        let t1_str = self.t1_buffer.format(t1);
        let t2 = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros();
        let t2_str = self.t2_buffer.format(t2);
        let content_length = self.content_length_buffer.format(
            json_header.len()
                + t1_str.len()
                + json_separator.len()
                + t2_str.len()
                + json_footer.len(),
        );

        let mut slices = [
            IoSlice::new(HTTP_HEADER.as_bytes()),
            IoSlice::new(content_length.as_bytes()),
            IoSlice::new(b"\r\n\r\n"),
            IoSlice::new(json_header.as_bytes()),
            IoSlice::new(t1_str.as_bytes()),
            IoSlice::new(json_separator.as_bytes()),
            IoSlice::new(t2_str.as_bytes()),
            IoSlice::new(json_footer.as_bytes()),
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
