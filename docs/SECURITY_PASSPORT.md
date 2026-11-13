# Launch Risk Passport

Page: `/launches/[id]/passport`. It is **not a security audit**. The risk band covers only the checks that ran, and unrun checks are listed as "unknown". No AI model is used for the findings today.

Every finding is labelled **verified fact**, **heuristic** or **unknown**, with an evidence line.

## Checks from the launch record (deterministic)
| Check | Result |
|---|---|
| Reserve price set | Info if > 0, Medium if 0 |
| Per-account cap | Info up to 25%; Medium if higher or none. A cap does not stop one person using several wallets |
| Auction code hash published | Info if present, High if missing |
| Token contract recorded | Info if present, High if missing |

## Checks from live NEAR RPC reads
| Check | How | Result |
|---|---|---|
| Contract deployed | `view_account`, code hash | High if the account is missing or has no code |
| Upgrade authority | `view_access_key_list` | Medium if any full-access key exists (code can be redeployed); Info if none. A contract may still upgrade itself in code; that is not visible here |
| Supply | `ft_metadata`, `ft_total_supply` vs the launch supply | Medium on mismatch; unknown if the contract is not NEP-141 |
| Creator wallet share | `ft_balance_of` | Info only: a high share before the sale is expected |
| Creator account | `view_account` | Existence and balance only |

## Always "unknown" (and why)
- **Mint / pause / freeze functions:** no standard on-chain way lists a contract's privileged methods; needs the source or an audit.
- **Full holder distribution and creator transaction history:** needs an indexer.
- **Liquidity setup and lock:** this product does not create a pool yet.

## Rules
- Failures become "unknown", never a guess.
- Heuristics (e.g. wallet clustering) must stay visibly separate from verified facts. None are implemented.
- Planned: AI explanations written after evidence collection, labelled as AI interpretation.
- Demo launches use made-up token addresses, so on-chain checks correctly report "not found". Real checks need a launch with a deployed token.
