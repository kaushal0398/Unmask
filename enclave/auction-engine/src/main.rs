//! Reads one request as JSON on stdin, writes one response as JSON on stdout.
//! On a bad request: nothing on stdout, the reason on stderr, exit code 1.
//! The same file builds natively and to `wasm32-wasip2` for OutLayer.
use std::io::{Read, Write};

fn main() {
    let mut raw = String::new();
    if let Err(e) = std::io::stdin().read_to_string(&mut raw) {
        eprintln!("could not read stdin: {e}");
        std::process::exit(1);
    }
    match auction_engine::handle(&raw) {
        Ok(out) => {
            std::io::stdout().write_all(out.as_bytes()).ok();
        }
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}
