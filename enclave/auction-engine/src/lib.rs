//! Deterministic integer-only uniform-price auction, version 1.
//!
//! This is a line-by-line port of `src/lib/auction-core.ts`. Both must produce
//! identical output for every case in `shared/test-vectors/auction-v1-cases.json`.
//! All amounts travel as canonical decimal strings and are computed as `u128`.
//! Any intermediate that would overflow `u128` is an error, never a wrap.
//!
//! Ties at the clearing price are split pro-rata in whole tokens; leftover
//! crumbs go to the largest remainders, then to the smallest bid id (byte order).
//! That is deterministic but NOT verifiable randomness (see docs/auction-core-v1.md).

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub const VERSION: &str = "1";
pub const MAX_BIDS: usize = 10_000;
pub const MAX_TOKEN_DECIMALS: u32 = 24;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bid {
    pub id: String,
    pub bidder: String,
    pub limit_price: String,
    pub quantity: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Input {
    pub version: String,
    pub auction_id: String,
    pub supply: String,
    pub reserve_price: String,
    pub token_decimals: u32,
    pub bids: Vec<Bid>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Fill {
    pub bid_id: String,
    pub bidder: String,
    pub limit_price: String,
    pub requested: String,
    pub filled: String,
    pub locked: String,
    pub payment: String,
    pub refund: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub version: String,
    pub auction_id: String,
    pub token_decimals: u32,
    pub clearing_price: String,
    pub supply: String,
    pub sold: String,
    pub unsold: String,
    pub total_raised: String,
    pub total_locked: String,
    pub total_refunded: String,
    pub fills: Vec<Fill>,
}

fn parse_uint(value: &str, field: &str, allow_zero: bool) -> Result<u128, String> {
    let canonical = !value.is_empty()
        && value.bytes().all(|b| b.is_ascii_digit())
        && (value == "0" || !value.starts_with('0'));
    if !canonical {
        return Err(format!("{field} must be a canonical unsigned integer string"));
    }
    let parsed: u128 = value.parse().map_err(|_| format!("{field} is too large"))?;
    if !allow_zero && parsed == 0 {
        return Err(format!("{field} must be greater than zero"));
    }
    Ok(parsed)
}

fn add(a: u128, b: u128) -> Result<u128, String> {
    a.checked_add(b).ok_or_else(|| "amount overflow".to_string())
}

/// Full 128x128 -> 256-bit product, as (high, low).
fn mul_wide(a: u128, b: u128) -> (u128, u128) {
    let (a_hi, a_lo) = (a >> 64, a & u64::MAX as u128);
    let (b_hi, b_lo) = (b >> 64, b & u64::MAX as u128);
    let ll = a_lo * b_lo;
    let lh = a_lo * b_hi;
    let hl = a_hi * b_lo;
    let hh = a_hi * b_hi;
    let mid = (ll >> 64) + (lh & u64::MAX as u128) + (hl & u64::MAX as u128);
    let lo = (ll & u64::MAX as u128) | (mid << 64);
    let hi = hh + (lh >> 64) + (hl >> 64) + (mid >> 64);
    (hi, lo)
}

/// floor(a * b / d) and (a * b) % d, computed exactly through a 256-bit intermediate.
/// Errors only if the quotient itself does not fit in u128.
fn mul_divrem(a: u128, b: u128, d: u128) -> Result<(u128, u128), String> {
    if d == 0 {
        return Err("denominator must be positive".into());
    }
    let (hi, lo) = mul_wide(a, b);
    let (mut q_hi, mut q_lo, mut r) = (0u128, 0u128, 0u128);
    for i in (0..256).rev() {
        let bit = if i >= 128 { (hi >> (i - 128)) & 1 } else { (lo >> i) & 1 };
        let carry = r >> 127;
        r = (r << 1) | bit;
        q_hi <<= 1;
        q_hi |= q_lo >> 127;
        q_lo <<= 1;
        if carry == 1 || r >= d {
            r = r.wrapping_sub(d);
            q_lo |= 1;
        }
    }
    if q_hi != 0 {
        return Err("amount overflow".into());
    }
    Ok((q_lo, r))
}

/// ceil(a * b / d), exact.
fn mul_ceil_div(a: u128, b: u128, d: u128) -> Result<u128, String> {
    let (q, r) = mul_divrem(a, b, d)?;
    if r > 0 { add(q, 1) } else { Ok(q) }
}

pub fn validate(input: &Input) -> Result<(), String> {
    if input.version != VERSION {
        return Err("unsupported auction core version".into());
    }
    if input.auction_id.is_empty() || input.auction_id.len() > 128 {
        return Err("auctionId is required and must be <= 128 chars".into());
    }
    parse_uint(&input.supply, "supply", false)?;
    parse_uint(&input.reserve_price, "reservePrice", false)?;
    if input.token_decimals > MAX_TOKEN_DECIMALS {
        return Err(format!("tokenDecimals must be an integer from 0 to {MAX_TOKEN_DECIMALS}"));
    }
    if input.bids.len() > MAX_BIDS {
        return Err(format!("bids cannot exceed {MAX_BIDS}"));
    }
    let mut ids = HashSet::new();
    for (i, bid) in input.bids.iter().enumerate() {
        if bid.id.is_empty() || bid.id.len() > 128 {
            return Err(format!("bids[{i}].id is required and must be <= 128 chars"));
        }
        if bid.bidder.is_empty() || bid.bidder.len() > 128 {
            return Err(format!("bids[{i}].bidder is required and must be <= 128 chars"));
        }
        if !ids.insert(bid.id.as_str()) {
            return Err(format!("duplicate bid id: {}", bid.id));
        }
        parse_uint(&bid.limit_price, &format!("bids[{i}].limitPrice"), false)?;
        parse_uint(&bid.quantity, &format!("bids[{i}].quantity"), false)?;
    }
    Ok(())
}

struct Parsed<'a> {
    bid: &'a Bid,
    limit: u128,
    quantity: u128,
}

/// Run the auction. Pure function: same input, same output, on every machine.
pub fn clear_auction(input: &Input) -> Result<Outcome, String> {
    validate(input)?;

    let supply = parse_uint(&input.supply, "supply", false)?;
    let reserve = parse_uint(&input.reserve_price, "reservePrice", false)?;
    let token_scale = 10u128.pow(input.token_decimals);

    let mut bids = Vec::with_capacity(input.bids.len());
    for bid in &input.bids {
        bids.push(Parsed {
            bid,
            limit: parse_uint(&bid.limit_price, "limitPrice", false)?,
            quantity: parse_uint(&bid.quantity, "quantity", false)?,
        });
    }

    // Eligible bids, highest limit first, ties by id.
    let mut eligible: Vec<&Parsed> = bids.iter().filter(|b| b.limit >= reserve).collect();
    eligible.sort_by(|a, b| b.limit.cmp(&a.limit).then_with(|| a.bid.id.cmp(&b.bid.id)));

    let mut total_demand = 0u128;
    for b in &eligible {
        total_demand = add(total_demand, b.quantity)?;
    }

    let mut clearing = reserve;
    if total_demand >= supply {
        let mut cumulative = 0u128;
        for b in &eligible {
            cumulative = add(cumulative, b.quantity)?;
            if cumulative >= supply {
                clearing = b.limit;
                break;
            }
        }
    }

    let mut allocations: HashMap<&str, u128> = HashMap::new();
    let mut remaining = supply;
    for b in eligible.iter().filter(|b| b.limit > clearing) {
        let fill = b.quantity.min(remaining);
        allocations.insert(b.bid.id.as_str(), fill);
        remaining -= fill;
    }

    let marginal: Vec<&&Parsed> = eligible.iter().filter(|b| b.limit == clearing).collect();
    let mut marginal_demand = 0u128;
    for b in &marginal {
        marginal_demand = add(marginal_demand, b.quantity)?;
    }
    let pot = remaining.min(marginal_demand);

    if pot > 0 && marginal_demand > 0 {
        struct Share<'a> {
            id: &'a str,
            remainder: u128,
        }
        let mut shares = Vec::with_capacity(marginal.len());
        let mut distributed = 0u128;
        for b in &marginal {
            let (whole, remainder) = mul_divrem(pot, b.quantity, marginal_demand)?;
            allocations.insert(b.bid.id.as_str(), whole);
            distributed += whole;
            shares.push(Share { id: b.bid.id.as_str(), remainder });
        }
        shares.sort_by(|a, b| b.remainder.cmp(&a.remainder).then_with(|| a.id.cmp(b.id)));
        let mut crumbs = pot - distributed;
        for share in &shares {
            if crumbs == 0 {
                break;
            }
            *allocations.entry(share.id).or_insert(0) += 1;
            crumbs -= 1;
        }
        if crumbs != 0 {
            return Err("internal allocation invariant failed".into());
        }
        remaining -= pot;
    }
    let _ = remaining;

    let mut fills = Vec::with_capacity(bids.len());
    let (mut sold, mut locked_total, mut raised, mut refunded) = (0u128, 0u128, 0u128, 0u128);
    for b in &bids {
        let filled = allocations.get(b.bid.id.as_str()).copied().unwrap_or(0);
        let locked = mul_ceil_div(b.limit, b.quantity, token_scale)?;
        let payment = mul_ceil_div(clearing, filled, token_scale)?;
        if payment > locked {
            return Err(format!("payment exceeds locked amount for bid {}", b.bid.id));
        }
        let refund = locked - payment;
        sold = add(sold, filled)?;
        locked_total = add(locked_total, locked)?;
        raised = add(raised, payment)?;
        refunded = add(refunded, refund)?;
        fills.push(Fill {
            bid_id: b.bid.id.clone(),
            bidder: b.bid.bidder.clone(),
            limit_price: b.limit.to_string(),
            requested: b.quantity.to_string(),
            filled: filled.to_string(),
            locked: locked.to_string(),
            payment: payment.to_string(),
            refund: refund.to_string(),
        });
    }

    if sold > supply {
        return Err("internal invariant failed: sold exceeds supply".into());
    }
    if locked_total != raised + refunded {
        return Err("internal invariant failed: locked != paid + refunded".into());
    }

    Ok(Outcome {
        version: VERSION.into(),
        auction_id: input.auction_id.clone(),
        token_decimals: input.token_decimals,
        clearing_price: clearing.to_string(),
        supply: supply.to_string(),
        sold: sold.to_string(),
        unsold: (supply - sold).to_string(),
        total_raised: raised.to_string(),
        total_locked: locked_total.to_string(),
        total_refunded: refunded.to_string(),
        fills,
    })
}

/// One request in, one JSON response out. This is the whole surface the WASM workload exposes.
///
/// * `{"action":"health"}` returns a small status object.
/// * `{"action":"clear_auction", ...}` or a bare auction input runs the auction.
///
/// Anything else is an error. Diagnostics never go to the response body.
pub fn handle(request: &str) -> Result<String, String> {
    let mut value: serde_json::Value = serde_json::from_str(request).map_err(|e| format!("invalid input: {e}"))?;
    let action = value.get("action").and_then(|a| a.as_str()).map(str::to_owned);
    match action.as_deref() {
        Some("health") => Ok(serde_json::json!({
            "status": "success",
            "action": "health",
            "engine": "unmask-auction-engine",
            "engine_version": env!("CARGO_PKG_VERSION"),
            "core_version": VERSION,
            "message": "Unmask auction engine is running",
        })
        .to_string()),
        Some("clear_auction") | None => {
            if let Some(obj) = value.as_object_mut() {
                obj.remove("action");
            }
            let input: Input = serde_json::from_value(value).map_err(|e| format!("invalid input: {e}"))?;
            let outcome = clear_auction(&input)?;
            serde_json::to_string(&outcome).map_err(|e| e.to_string())
        }
        Some(other) => Err(format!("unknown action: {other}")),
    }
}
