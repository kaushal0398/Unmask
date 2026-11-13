//! Policy-controlled community treasury for launch proceeds (native NEAR).
//!
//! What the CONTRACT enforces (not the UI):
//! - The allocation policy (category -> share in basis points, summing to 10_000) is fixed at `new` and has no setter.
//! - A category may never spend more than its share of everything deposited so far (spent + pending reserved + new).
//! - Every payout needs `threshold` distinct signer approvals and must wait out a timelock from the proposal time.
//! - Only listed signers can propose, approve, cancel (own proposals) or execute.
//!
//! Not enforced / not implemented: fungible-token proceeds (only attached NEAR is held), governance votes,
//! and any link to the auction contract. Depositing is open to anyone.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{U128, U64};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise};

pub const BPS_TOTAL: u16 = 10_000;

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
enum Key {
    Categories,
    Proposals,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub enum Status {
    Pending,
    Executed,
    Cancelled,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Proposal {
    pub id: u64,
    pub category: String,
    pub receiver: AccountId,
    pub amount: U128,
    pub reason: String,
    pub proposer: AccountId,
    pub approvals: Vec<AccountId>,
    pub created_ns: U64,
    /// Earliest time `execute` may succeed.
    pub unlocks_ns: U64,
    pub status: Status,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct CategoryStatus {
    pub name: String,
    pub share_bps: u16,
    pub cap: U128,
    pub spent: U128,
    pub reserved: U128,
    pub available: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Treasury {
    signers: Vec<AccountId>,
    threshold: u8,
    timelock_ns: u64,
    names: Vec<String>,
    shares: IterableMap<String, u16>,
    spent: LookupMap<String, u128>,
    reserved: LookupMap<String, u128>,
    total_received: u128,
    proposals: IterableMap<u64, Proposal>,
    next_id: u64,
}

#[near]
impl Treasury {
    #[init]
    pub fn new(signers: Vec<AccountId>, threshold: u8, timelock_ns: U64, policy: Vec<(String, u16)>) -> Self {
        require!(!signers.is_empty(), "need at least one signer");
        for (i, s) in signers.iter().enumerate() {
            require!(!signers[..i].contains(s), "duplicate signer");
        }
        require!(threshold >= 1 && (threshold as usize) <= signers.len(), "threshold must be 1..=signers");
        require!(!policy.is_empty(), "policy is empty");
        let mut total: u32 = 0;
        let mut shares = IterableMap::new(Key::Categories);
        let mut names = Vec::new();
        for (name, bps) in policy {
            require!(bps > 0, "a category needs a share above zero");
            require!(!name.trim().is_empty(), "category name is empty");
            require!(!names.contains(&name), "duplicate category");
            total += bps as u32;
            names.push(name.clone());
            shares.insert(name, bps);
        }
        require!(total == BPS_TOTAL as u32, "shares must add up to 10000 bps");
        Self {
            signers,
            threshold,
            timelock_ns: timelock_ns.0,
            names,
            shares,
            spent: LookupMap::new(b"s".to_vec()),
            reserved: LookupMap::new(b"r".to_vec()),
            total_received: 0,
            proposals: IterableMap::new(Key::Proposals),
            next_id: 0,
        }
    }

    /// Anyone may add funds. Each deposit raises every category's cap by its share.
    #[payable]
    pub fn deposit(&mut self) {
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "attach a deposit");
        self.total_received += amount;
        env::log_str(&format!("EVENT deposit from={} amount={}", env::predecessor_account_id(), amount));
    }

    pub fn propose(&mut self, category: String, receiver: AccountId, amount: U128, reason: String) -> u64 {
        let who = self.signer();
        require!(amount.0 > 0, "amount must be above zero");
        require!(!reason.trim().is_empty(), "a reason is required");
        let st = self.category_status(category.clone());
        require!(amount.0 <= st.available.0, "outside policy: exceeds the category's remaining cap");
        let id = self.next_id;
        self.next_id += 1;
        let r = self.reserved.get(&category).copied().unwrap_or(0) + amount.0;
        self.reserved.insert(category.clone(), r);
        let now = env::block_timestamp();
        self.proposals.insert(
            id,
            Proposal {
                id,
                category,
                receiver,
                amount,
                reason,
                proposer: who.clone(),
                approvals: vec![who],
                created_ns: U64(now),
                unlocks_ns: U64(now + self.timelock_ns),
                status: Status::Pending,
            },
        );
        id
    }

    pub fn approve(&mut self, id: u64) {
        let who = self.signer();
        let p = self.proposals.get_mut(&id).unwrap_or_else(|| env::panic_str("no such proposal"));
        require!(p.status == Status::Pending, "proposal is not pending");
        require!(!p.approvals.contains(&who), "already approved");
        p.approvals.push(who);
    }

    pub fn cancel(&mut self, id: u64) {
        let who = self.signer();
        let (cat, amt) = {
            let p = self.proposals.get_mut(&id).unwrap_or_else(|| env::panic_str("no such proposal"));
            require!(p.status == Status::Pending, "proposal is not pending");
            require!(p.proposer == who, "only the proposer can cancel");
            p.status = Status::Cancelled;
            (p.category.clone(), p.amount.0)
        };
        self.release(&cat, amt);
    }

    pub fn execute(&mut self, id: u64) -> Promise {
        self.signer();
        let threshold = self.threshold as usize;
        let (cat, amt, to) = {
            let p = self.proposals.get_mut(&id).unwrap_or_else(|| env::panic_str("no such proposal"));
            require!(p.status == Status::Pending, "proposal is not pending");
            require!(p.approvals.len() >= threshold, "not enough approvals");
            require!(env::block_timestamp() >= p.unlocks_ns.0, "timelock has not elapsed");
            p.status = Status::Executed;
            (p.category.clone(), p.amount.0, p.receiver.clone())
        };
        self.release(&cat, amt);
        let s = self.spent.get(&cat).copied().unwrap_or(0) + amt;
        self.spent.insert(cat.clone(), s);
        env::log_str(&format!("EVENT payout id={} category={} to={} amount={}", id, cat, to, amt));
        Promise::new(to).transfer(NearToken::from_yoctonear(amt))
    }

    // ---- views -------------------------------------------------------------------------------

    pub fn get_config(&self) -> (Vec<AccountId>, u8, U64, U128) {
        (self.signers.clone(), self.threshold, U64(self.timelock_ns), U128(self.total_received))
    }

    pub fn category_status(&self, name: String) -> CategoryStatus {
        let bps = *self.shares.get(&name).unwrap_or_else(|| env::panic_str("outside policy: unknown category"));
        let cap = self.total_received * bps as u128 / BPS_TOTAL as u128;
        let spent = self.spent.get(&name).copied().unwrap_or(0);
        let reserved = self.reserved.get(&name).copied().unwrap_or(0);
        CategoryStatus {
            name,
            share_bps: bps,
            cap: U128(cap),
            spent: U128(spent),
            reserved: U128(reserved),
            available: U128(cap.saturating_sub(spent + reserved)),
        }
    }

    pub fn policy(&self) -> Vec<CategoryStatus> {
        self.names.iter().map(|n| self.category_status(n.clone())).collect()
    }

    pub fn get_proposals(&self) -> Vec<Proposal> {
        self.proposals.values().cloned().collect()
    }

    // ---- internals ---------------------------------------------------------------------------

    fn signer(&self) -> AccountId {
        let who = env::predecessor_account_id();
        require!(self.signers.contains(&who), "only a listed signer can do this");
        who
    }

    fn release(&mut self, cat: &str, amt: u128) {
        let r = self.reserved.get(cat).copied().unwrap_or(0).saturating_sub(amt);
        self.reserved.insert(cat.to_string(), r);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const NEAR: u128 = 10u128.pow(24);

    fn acct(s: &str) -> AccountId {
        s.parse().unwrap()
    }
    fn ctx(who: &str, deposit: u128, ts: u64) {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(acct(who))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(ts)
            .build());
    }
    fn make(threshold: u8) -> Treasury {
        ctx("a.near", 0, 0);
        let mut t = Treasury::new(
            vec![acct("a.near"), acct("b.near"), acct("c.near")],
            threshold,
            U64(1000),
            vec![("dev".into(), 6000), ("grants".into(), 3000), ("reserve".into(), 1000)],
        );
        ctx("anyone.near", 100 * NEAR, 0);
        t.deposit();
        t
    }

    #[test]
    #[should_panic(expected = "add up to 10000")]
    fn policy_must_sum_to_100_percent() {
        ctx("a.near", 0, 0);
        Treasury::new(vec![acct("a.near")], 1, U64(0), vec![("dev".into(), 5000)]);
    }

    #[test]
    fn caps_follow_deposits() {
        let t = make(2);
        assert_eq!(t.category_status("dev".into()).cap.0, 60 * NEAR);
        assert_eq!(t.category_status("reserve".into()).cap.0, 10 * NEAR);
    }

    #[test]
    #[should_panic(expected = "unknown category")]
    fn unlisted_category_is_rejected() {
        let mut t = make(2);
        ctx("a.near", 0, 0);
        t.propose("party".into(), acct("x.near"), U128(NEAR), "fun".into());
    }

    #[test]
    #[should_panic(expected = "exceeds the category's remaining cap")]
    fn over_cap_is_rejected() {
        let mut t = make(2);
        ctx("a.near", 0, 0);
        t.propose("reserve".into(), acct("x.near"), U128(11 * NEAR), "too much".into());
    }

    #[test]
    #[should_panic(expected = "only a listed signer")]
    fn outsiders_cannot_propose() {
        let mut t = make(2);
        ctx("evil.near", 0, 0);
        t.propose("dev".into(), acct("evil.near"), U128(NEAR), "hi".into());
    }

    #[test]
    #[should_panic(expected = "not enough approvals")]
    fn needs_threshold_approvals() {
        let mut t = make(2);
        ctx("a.near", 0, 0);
        let id = t.propose("dev".into(), acct("x.near"), U128(NEAR), "build".into());
        ctx("a.near", 0, 5000);
        t.execute(id);
    }

    #[test]
    #[should_panic(expected = "timelock")]
    fn timelock_blocks_early_execution() {
        let mut t = make(2);
        ctx("a.near", 0, 0);
        let id = t.propose("dev".into(), acct("x.near"), U128(NEAR), "build".into());
        ctx("b.near", 0, 10);
        t.approve(id);
        t.execute(id);
    }

    #[test]
    #[should_panic(expected = "already approved")]
    fn one_signer_cannot_approve_twice() {
        let mut t = make(2);
        ctx("a.near", 0, 0);
        let id = t.propose("dev".into(), acct("x.near"), U128(NEAR), "build".into());
        t.approve(id);
    }

    #[test]
    fn full_flow_and_cap_accounting() {
        let mut t = make(2);
        ctx("a.near", 0, 0);
        let id = t.propose("dev".into(), acct("x.near"), U128(50 * NEAR), "milestone 1".into());
        assert_eq!(t.category_status("dev".into()).available.0, 10 * NEAR);
        ctx("b.near", 0, 10);
        t.approve(id);
        ctx("c.near", 0, 1000);
        let _ = t.execute(id);
        let s = t.category_status("dev".into());
        assert_eq!((s.spent.0, s.reserved.0, s.available.0), (50 * NEAR, 0, 10 * NEAR));
        assert!(t.get_proposals()[0].status == Status::Executed);
    }

    #[test]
    #[should_panic(expected = "not pending")]
    fn cannot_execute_twice() {
        let mut t = make(1);
        ctx("a.near", 0, 0);
        let id = t.propose("dev".into(), acct("x.near"), U128(NEAR), "build".into());
        ctx("a.near", 0, 2000);
        let _ = t.execute(id);
        let _ = t.execute(id);
    }

    #[test]
    fn cancel_releases_the_reservation() {
        let mut t = make(2);
        ctx("a.near", 0, 0);
        let id = t.propose("dev".into(), acct("x.near"), U128(60 * NEAR), "all".into());
        assert_eq!(t.category_status("dev".into()).available.0, 0);
        t.cancel(id);
        assert_eq!(t.category_status("dev".into()).available.0, 60 * NEAR);
    }
}
