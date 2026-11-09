//! Reads one auction input as JSON on stdin, writes the outcome as JSON on stdout.
//! Exit code 1 with the reason on stderr if the input is invalid.
use std::io::{Read, Write};

fn main() {
    let mut raw = String::new();
    if let Err(e) = std::io::stdin().read_to_string(&mut raw) {
        eprintln!("could not read stdin: {e}");
        std::process::exit(1);
    }
    let input: auction_engine::Input = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("invalid input: {e}");
            std::process::exit(1);
        }
    };
    match auction_engine::clear_auction(&input) {
        Ok(outcome) => {
            let out = serde_json::to_string(&outcome).expect("outcome serializes");
            std::io::stdout().write_all(out.as_bytes()).ok();
        }
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}
