#!/bin/sh
# Builds the CANONICAL auction engine (enclave/auction-engine) to WASM for OutLayer.
# The Hello World in ./src is the generated scaffold and is not deployed.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ENGINE="$HERE/../enclave/auction-engine"
cargo build --manifest-path "$ENGINE/Cargo.toml" --target wasm32-wasip2 --release
mkdir -p "$HERE/out"
cp "$ENGINE/target/wasm32-wasip2/release/auction-engine.wasm" "$HERE/out/auction-engine.wasm"
echo "built $HERE/out/auction-engine.wasm"
shasum -a 256 "$HERE/out/auction-engine.wasm"
