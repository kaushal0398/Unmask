//! The Rust engine must match the TypeScript rule on every shared case.
use auction_engine::{Input, clear_auction};
use serde_json::Value;

const CASES: &str = include_str!("../../../shared/test-vectors/auction-v1-cases.json");
const FIRST: &str = include_str!("../../../shared/test-vectors/auction-v1.json");

fn check(name: &str, input: &Value, expected: &Value) {
    let input: Input = serde_json::from_value(input.clone()).unwrap_or_else(|e| panic!("{name}: bad input: {e}"));
    let outcome = clear_auction(&input).unwrap_or_else(|e| panic!("{name}: engine error: {e}"));
    let got = serde_json::to_value(&outcome).unwrap();
    assert_eq!(&got, expected, "case `{name}` differs from the TypeScript output");
}

#[test]
fn matches_every_generated_case() {
    let doc: Value = serde_json::from_str(CASES).unwrap();
    let cases = doc["cases"].as_array().unwrap();
    assert!(cases.len() >= 10, "expected the full case list");
    for c in cases {
        check(c["name"].as_str().unwrap(), &c["input"], &c["expected"]);
    }
}

#[test]
fn matches_the_original_worked_example() {
    let doc: Value = serde_json::from_str(FIRST).unwrap();
    check("auction-v1.json", &doc["input"], &doc["expected"]);
}

#[test]
fn rejects_invalid_input() {
    let bad = |s: &str| clear_auction(&serde_json::from_str::<Input>(s).unwrap()).is_err();
    let head = r#""version":"1","auctionId":"x","supply":"10","reservePrice":"1","tokenDecimals":0"#;
    assert!(bad(&format!(r#"{{{head},"bids":[{{"id":"A","bidder":"a","limitPrice":"01","quantity":"1"}}]}}"#)), "leading zero");
    assert!(bad(&format!(r#"{{{head},"bids":[{{"id":"A","bidder":"a","limitPrice":"1","quantity":"0"}}]}}"#)), "zero quantity");
    assert!(bad(&format!(r#"{{{head},"bids":[{{"id":"A","bidder":"a","limitPrice":"1","quantity":"1"}},{{"id":"A","bidder":"b","limitPrice":"1","quantity":"1"}}]}}"#)), "duplicate id");
    assert!(bad(r#"{"version":"2","auctionId":"x","supply":"10","reservePrice":"1","tokenDecimals":0,"bids":[]}"#), "version");
    assert!(bad(r#"{"version":"1","auctionId":"x","supply":"10","reservePrice":"1","tokenDecimals":25,"bids":[]}"#), "decimals");
}

/// 256-bit intermediates: these products exceed u128 but the results fit.
#[test]
fn handles_products_larger_than_u128() {
    let input = r#"{"version":"1","auctionId":"big","supply":"1000000000000000000000000","reservePrice":"1","tokenDecimals":24,
      "bids":[{"id":"A","bidder":"a","limitPrice":"340282366920938463463374607431768211455","quantity":"1000000000000000000000000"}]}"#;
    let out = clear_auction(&serde_json::from_str::<Input>(input).unwrap()).unwrap();
    assert_eq!(out.fills[0].locked, "340282366920938463463374607431768211455");
    assert_eq!(out.fills[0].filled, "1000000000000000000000000");
}

#[test]
fn health_and_action_envelope() {
    let health: Value = serde_json::from_str(&auction_engine::handle(r#"{"action":"health"}"#).unwrap()).unwrap();
    assert_eq!(health["status"], "success");
    assert_eq!(health["action"], "health");

    // A `clear_auction` envelope gives the same answer as a bare input.
    let doc: Value = serde_json::from_str(FIRST).unwrap();
    let bare = auction_engine::handle(&doc["input"].to_string()).unwrap();
    let mut wrapped = doc["input"].clone();
    wrapped["action"] = Value::String("clear_auction".into());
    assert_eq!(auction_engine::handle(&wrapped.to_string()).unwrap(), bare);

    assert!(auction_engine::handle(r#"{"action":"mint_tokens"}"#).unwrap_err().contains("unknown action"));
    assert!(auction_engine::handle("not json").is_err());
}
