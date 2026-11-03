
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Bid {
    pub bidder: String,
    pub quantity: u64,
    pub limit_price: u64,
}

#[derive(Debug, Serialize)]
pub struct AuctionResult {
    pub clearing_price: u64,
    pub allocated_quantity: u64,
    pub winner_count: usize,
}

pub fn clear_auction(
    mut bids: Vec<Bid>,
    supply: u64,
) -> AuctionResult {
    bids.sort_by(|a, b| b.limit_price.cmp(&a.limit_price));

    let mut remaining = supply;
    let mut clearing_price = 0;
    let mut allocated_quantity = 0;
    let mut winner_count = 0;

    for bid in bids {
        if remaining == 0 {
            break;
        }

        let allocated = bid.quantity.min(remaining);

        if allocated > 0 {
            remaining -= allocated;
            allocated_quantity += allocated;
            clearing_price = bid.limit_price;
            winner_count += 1;
        }
    }

    AuctionResult {
        clearing_price,
        allocated_quantity,
        winner_count,
    }
}
