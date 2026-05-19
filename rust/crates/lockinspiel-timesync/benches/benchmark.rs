use std::{
    io::Cursor,
    time::{SystemTime, UNIX_EPOCH},
};

use criterion::{Criterion, criterion_group, criterion_main};
use lockinspiel_timesync::ResponseBuffer;

fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("request/response", |b| {
        let mut response_buffer = ResponseBuffer::new();
        b.iter(|| {
            let n2 = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_micros();
            let mut buffer = Cursor::new([0; 2048]);
            response_buffer.response(n2, &mut buffer);
            buffer
        })
    });
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
