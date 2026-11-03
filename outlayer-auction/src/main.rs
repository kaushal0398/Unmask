use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};

#[derive(Debug, Deserialize)]
struct Input {
    action: String,
    supply: u64,
    reserve_price: u64,
    bids: Vec<Bid>,
}

#[derive(Debug, Deserialize)]
struct Bid {
    bidder: String,
    quantity: u64,
    limit_price: u64,
}

#[derive(Debug, Serialize)]
struct Allocation {
    bidder: String,
    requested_quantity: u64,
    allocated_quantity: u64,
    limit_price: u64,
    clearing_price: u64,
}

#[derive(Debug, Serialize)]
struct Output {
    status: String,
    clearing_price: u64,
    total_allocated: u64,
    remaining_supply: u64,
    winner_count: usize,
    allocations: Vec<Allocation>,
}

fn clear_auction(input: Input) -> Result<Output, String> {
    if input.supply == 0 {
        return Err("Supply must be greater than zero".into());
    }

    let mut bids = input.bids;

    for bid in &bids {
        if bid.bidder.trim().is_empty() {
            return Err("Bidder cannot be empty".into());
        }
        if bid.quantity == 0 {
            return Err("Bid quantity must be greater than zero".into());
        }
        if bid.limit_price == 0 {
            return Err("Bid limit price must be greater than zero".into());
        }
    }

    // One bid per bidder in this prototype; enforce this in the backend too.
    bids.sort_by(|a, b| {
        b.limit_price
            .cmp(&a.limit_price)
            .then_with(|| a.bidder.cmp(&b.bidder))
    });

    for i in 0..bids.len() {
        if bids[..i].iter().any(|previous| previous.bidder == bids[i].bidder) {
            return Err("Duplicate bidder detected".into());
        }
    }

    let mut allocations = Vec::new();
    let mut remaining = input.supply;

    // If eligible demand does not exhaust supply, the reserve is the price.
    // If supply is exhausted in a price tier, that tier is the marginal price.
    let mut clearing_price = input.reserve_price;
    let mut index = 0;

    while index < bids.len() && remaining > 0 {
        let price = bids[index].limit_price;

        if price < input.reserve_price {
            break;
        }

        let mut end = index + 1;
        while end < bids.len() && bids[end].limit_price == price {
            end += 1;
        }

        let tier = &bids[index..end];

        let demand = tier.iter().try_fold(0u64, |sum, bid| {
            sum.checked_add(bid.quantity)
                .ok_or_else(|| "Bid demand overflow".to_string())
        })?;

        if demand <= remaining {
            for bid in tier {
                allocations.push(Allocation {
                    bidder: bid.bidder.clone(),
                    requested_quantity: bid.quantity,
                    allocated_quantity: bid.quantity,
                    limit_price: bid.limit_price,
                    clearing_price: input.reserve_price,
                });
            }

            remaining -= demand;
            index = end;
        } else {
            // Pro-rata allocation for the oversubscribed marginal price tier.
            // Largest remainders receive indivisible units; bidder ID breaks ties.
            let mut tier_allocations: Vec<(usize, u64, u64)> = tier
                .iter()
                .enumerate()
                .map(|(i, bid)| {
                    let numerator = (bid.quantity as u128) * (remaining as u128);
                    let base = (numerator / demand as u128) as u64;
                    let remainder = (numerator % demand as u128) as u64;
                    (i, base, remainder)
                })
                .collect();

            let allocated = tier_allocations.iter().try_fold(0u64, |sum, item| {
                sum.checked_add(item.1)
                    .ok_or_else(|| "Allocation total overflow".to_string())
            })?;

            let mut leftover = remaining
                .checked_sub(allocated)
                .ok_or_else(|| "Allocation exceeds remaining supply".to_string())?;

            tier_allocations.sort_by(|a, b| {
                b.2.cmp(&a.2)
                    .then_with(|| tier[a.0].bidder.cmp(&tier[b.0].bidder))
            });

            for allocation in &mut tier_allocations {
                if leftover == 0 {
                    break;
                }
                allocation.1 += 1;
                leftover -= 1;
            }

            for (i, quantity, _) in tier_allocations {
                let bid = &tier[i];
                allocations.push(Allocation {
                    bidder: bid.bidder.clone(),
                    requested_quantity: bid.quantity,
                    allocated_quantity: quantity,
                    limit_price: bid.limit_price,
                    clearing_price: price,
                });
            }

            clearing_price = price;
            remaining = 0;
            break;
        }
    }

    // Every winner pays exactly the same final clearing price.
    for allocation in &mut allocations {
        allocation.clearing_price = clearing_price;
    }

    allocations.sort_by(|a, b| a.bidder.cmp(&b.bidder));

    let total_allocated = input.supply - remaining;
    let winner_count = allocations
        .iter()
        .filter(|allocation| allocation.allocated_quantity > 0)
        .count();

    Ok(Output {
        status: "success".into(),
        clearing_price,
        total_allocated,
        remaining_supply: remaining,
        winner_count,
        allocations,
    })
}

fn main() {
    let result = (|| -> Result<String, String> {
        let mut input = String::new();

        io::stdin()
            .read_to_string(&mut input)
            .map_err(|error| error.to_string())?;

        let request: Input =
            serde_json::from_str(&input).map_err(|error| error.to_string())?;

        if request.action != "clear_auction" {
            return Err("Unsupported action".into());
        }

        let output = clear_auction(request)?;
        serde_json::to_string(&output).map_err(|error| error.to_string())
    })();

    let response = match result {
        Ok(json) => json,
        Err(error) => serde_json::json!({
            "status": "error",
            "message": error
        })
        .to_string(),
    };

    let mut stdout = io::stdout().lock();
    if writeln!(stdout, "{}", response).is_ok() {
        let _ = stdout.flush();
    }
}