//! Settlement anchor registry.
//!
//! Records a COMMITMENT to an auction result on-chain: the input hash, output hash, engine code hash and clearing
//! price. It does NOT move tokens or funds and it does NOT prove the auction ran correctly or in a TEE: it proves
//! only that this writer published these hashes for this launch at this block, and that they cannot be changed.
//!
//! - Only the `writer` account set at `new` can anchor (so nobody can pre-empt a launch with a fake result).
//! - One anchor per launch id; a second write is rejected.

use near_sdk::json_types::U64;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, PanicOnDefault};

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Anchor {
    pub launch_id: String,
    pub input_hash: String,
    pub output_hash: String,
    pub code_hash: String,
    pub clearing_price: String,
    pub mode: String,
    pub block_height: U64,
    pub block_timestamp_ns: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Registry {
    writer: AccountId,
    anchors: LookupMap<String, Anchor>,
}

#[near]
impl Registry {
    #[init]
    pub fn new(writer: AccountId) -> Self {
        Self { writer, anchors: LookupMap::new(b"a".to_vec()) }
    }

    pub fn anchor(&mut self, launch_id: String, input_hash: String, output_hash: String, code_hash: String, clearing_price: String, mode: String) {
        require!(env::predecessor_account_id() == self.writer, "only the writer can anchor results");
        require!(!launch_id.is_empty() && launch_id.len() <= 128, "bad launch id");
        require!(input_hash.len() <= 128 && output_hash.len() <= 128 && code_hash.len() <= 128, "hash too long");
        require!(clearing_price.len() <= 64 && mode.len() <= 16, "field too long");
        require!(self.anchors.get(&launch_id).is_none(), "this launch is already anchored");
        env::log_str(&format!("EVENT anchor launch={} input={} output={} code={} price={} mode={}", launch_id, input_hash, output_hash, code_hash, clearing_price, mode));
        self.anchors.insert(
            launch_id.clone(),
            Anchor {
                launch_id,
                input_hash,
                output_hash,
                code_hash,
                clearing_price,
                mode,
                block_height: U64(env::block_height()),
                block_timestamp_ns: U64(env::block_timestamp()),
            },
        );
    }

    pub fn get_anchor(&self, launch_id: String) -> Option<Anchor> {
        self.anchors.get(&launch_id).cloned()
    }

    pub fn get_writer(&self) -> AccountId {
        self.writer.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn who(s: &str) {
        testing_env!(VMContextBuilder::new().predecessor_account_id(s.parse().unwrap()).build());
    }
    fn make() -> Registry {
        who("w.near");
        Registry::new("w.near".parse().unwrap())
    }
    fn a(r: &mut Registry, id: &str) {
        r.anchor(id.into(), "i".into(), "o".into(), "c".into(), "0.05".into(), "dev".into());
    }

    #[test]
    fn writer_can_anchor_and_read_back() {
        let mut r = make();
        a(&mut r, "L1");
        let got = r.get_anchor("L1".into()).unwrap();
        assert_eq!((got.input_hash.as_str(), got.clearing_price.as_str()), ("i", "0.05"));
        assert!(r.get_anchor("L2".into()).is_none());
    }

    #[test]
    #[should_panic(expected = "only the writer")]
    fn strangers_cannot_anchor() {
        let mut r = make();
        who("evil.near");
        a(&mut r, "L1");
    }

    #[test]
    #[should_panic(expected = "already anchored")]
    fn cannot_anchor_twice() {
        let mut r = make();
        a(&mut r, "L1");
        a(&mut r, "L1");
    }
}
