//! Property tests for the Rust engine: the guarantees of the rule, checked on thousands of random auctions.
//! Same properties as src/lib/auction-properties.test.ts. Small numbers on purpose so ties and rounding come up constantly.
use auction_engine::{Bid, Input, Outcome, clear_auction};
use serde_json::Value;

struct Rng(u32);
impl Rng {
    fn next(&mut self, n: u32) -> u32 {
        self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223);
        self.0 % n
    }
}

fn random_auction(r: &mut Rng, id: String) -> Input {
    let decimals = r.next(4);
    let n = r.next(13);
    let bids = (0..n)
        .map(|i| Bid { id: format!("b{i}"), bidder: format!("u{i}.near"), limit_price: (1 + r.next(8)).to_string(), quantity: (1 + r.next(30)).to_string() })
        .collect();
    Input { version: "1".into(), auction_id: id, supply: (1 + r.next(50)).to_string(), reserve_price: (1 + r.next(5)).to_string(), token_decimals: decimals, bids }
}

fn u(s: &str) -> u128 { s.parse().unwrap() }
fn ceil_div(a: u128, b: u128) -> u128 { if a == 0 { 0 } else { (a + b - 1) / b } }

fn check(input: &Input, out: &Outcome, at: &str) {
    let supply = u(&input.supply);
    let reserve = u(&input.reserve_price);
    let price = u(&out.clearing_price);
    let scale = 10u128.pow(input.token_decimals);
    let demand: u128 = input.bids.iter().filter(|b| u(&b.limit_price) >= reserve).map(|b| u(&b.quantity)).sum();
    let sold: u128 = out.fills.iter().map(|f| u(&f.filled)).sum();

    assert!(sold <= supply, "{at}: sold {sold} exceeds supply {supply}");
    assert_eq!(sold, if demand >= supply { supply } else { demand }, "{at}: sells the whole supply if demand allows, otherwise all eligible demand");
    assert_eq!(u(&out.unsold), supply - sold, "{at}: unsold");
    assert!(price >= reserve, "{at}: clearing price below the reserve");
    assert_eq!(out.fills.len(), input.bids.len(), "{at}: one fill per bid");

    let (mut locked_total, mut paid_total, mut refund_total) = (0u128, 0u128, 0u128);
    let mut at_price: Vec<(String, u128, u128)> = vec![];
    for (bid, f) in input.bids.iter().zip(&out.fills) {
        assert_eq!(f.bid_id, bid.id, "{at}: fills keep the input order");
        let (limit, qty, filled) = (u(&bid.limit_price), u(&bid.quantity), u(&f.filled));
        assert!(filled <= qty, "{at}: {} got more than it asked for", bid.id);
        if limit < reserve { assert_eq!(filled, 0, "{at}: {} is below the reserve", bid.id); }
        if filled > 0 { assert!(limit >= price, "{at}: {} won below the clearing price", bid.id); }
        if limit > price { assert_eq!(filled, qty, "{at}: {} bid above the clearing price and must be filled in full", bid.id); }
        if limit == price && limit >= reserve { at_price.push((bid.id.clone(), qty, filled)); }

        let locked = ceil_div(limit * qty, scale);
        assert_eq!(u(&f.locked), locked, "{at}: {} locked", bid.id);
        assert_eq!(u(&f.payment), ceil_div(price * filled, scale), "{at}: {} pays the uniform price", bid.id);
        assert!(u(&f.payment) <= locked, "{at}: {} pays more than it locked", bid.id);
        assert!(u(&f.payment) <= ceil_div(limit * filled, scale), "{at}: {} pays more than its own limit would cost", bid.id);
        assert_eq!(u(&f.refund), locked - u(&f.payment), "{at}: {} refund", bid.id);
        locked_total += locked;
        paid_total += u(&f.payment);
        refund_total += u(&f.refund);
    }
    assert_eq!(locked_total, paid_total + refund_total, "{at}: locked = paid + refunded");
    assert_eq!(u(&out.total_raised), paid_total, "{at}: totalRaised");

    // At the marginal price: everyone gets the rounded-down share, and the leftover tokens go one each to the
    // LARGEST remainders first, ties to the lowest bid id.
    let demand_at: u128 = at_price.iter().map(|b| b.1).sum();
    let pot: u128 = at_price.iter().map(|b| b.2).sum();
    if demand_at > 0 && pot < demand_at {
        let shares: Vec<_> = at_price.iter().map(|(id, q, f)| (id.clone(), *f, pot * q / demand_at, pot * q % demand_at)).collect();
        for (id, filled, exact, _) in &shares {
            assert!(filled == exact || *filled == exact + 1, "{at}: {id} got {filled}, its share is {exact} or one more");
        }
        for w in shares.iter().filter(|s| s.1 == s.2 + 1) {
            for l in shares.iter().filter(|s| s.1 == s.2) {
                assert!(w.3 > l.3 || (w.3 == l.3 && w.0 < l.0), "{at}: {} (remainder {}) got a crumb ahead of {} (remainder {})", w.0, w.3, l.0, l.3);
            }
        }
    }
}

#[test]
fn holds_on_3000_random_auctions() {
    let mut r = Rng(20261110);
    for i in 0..3000 {
        let input = random_auction(&mut r, format!("p{i}"));
        let out = clear_auction(&input).unwrap_or_else(|e| panic!("#{i}: {e}"));
        check(&input, &out, &format!("seed 20261110 #{i}"));
    }
}

#[test]
fn does_not_depend_on_the_order_bids_arrive_in() {
    let mut r = Rng(20261111);
    for i in 0..1000 {
        let input = random_auction(&mut r, format!("o{i}"));
        let mut shuffled = input.clone();
        for k in (1..shuffled.bids.len()).rev() {
            let j = r.next(k as u32 + 1) as usize;
            shuffled.bids.swap(k, j);
        }
        let a = clear_auction(&input).unwrap();
        let b = clear_auction(&shuffled).unwrap();
        assert_eq!(a.clearing_price, b.clearing_price, "#{i}: price");
        let sorted = |o: &Outcome| { let mut f = o.fills.clone(); f.sort_by(|x, y| x.bid_id.cmp(&y.bid_id)); f };
        assert_eq!(sorted(&a), sorted(&b), "#{i}: allocations");
    }
}

#[test]
fn matches_the_200_seeded_random_cases_from_typescript() {
    let doc: Value = serde_json::from_str(include_str!("../../../shared/test-vectors/auction-v1-random.json")).unwrap();
    let cases = doc["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 200);
    for c in cases {
        let input: Input = serde_json::from_value(c["input"].clone()).unwrap();
        let got = serde_json::to_value(clear_auction(&input).unwrap()).unwrap();
        assert_eq!(got, c["expected"], "{} differs from the TypeScript output", c["name"]);
    }
}
