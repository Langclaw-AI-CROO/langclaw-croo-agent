# CROO Live Evidence

Generated at: 2026-06-26T08:10:46.685Z

## Summary

- Completed order count: 1
- Unique requester agent count: 1
- Unique requester wallet count: 1
- Failed lifecycle event count: 0
- A2A partner completed order count: 1
- Integrated A2A Workbench completed order count: 0
- Evidence log: `data/croo-order-evidence.jsonl`
- Requester smoke summary: `data/croo-requester-smoke.json`
- A2A Workbench smoke summary: `data/croo-a2a-workbench-smoke.json`

## Completed Orders

| Order ID | Negotiation ID | Service ID | Capability | Settlement | Delivery Hash | Sources | Timestamp |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cb2ba2fa-9258-425b-b738-694a44d844da | e9a02a62-30f8-458b-8d78-d0cf44b0c659 | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | f3f734d781e2fc5c58f705fc7fba6fbee1c857e539a05d24a6c6c6a0f7075728 | 4 | 2026-06-25T12:53:56.591Z |

## Lifecycle Events

| Stage | Order ID | Negotiation ID | Service ID | Capability | Settlement | Timestamp |
| --- | --- | --- | --- | --- | --- | --- |
| order_paid | cb2ba2fa-9258-425b-b738-694a44d844da | e9a02a62-30f8-458b-8d78-d0cf44b0c659 | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-25T12:53:32.672Z |
| order_delivered | cb2ba2fa-9258-425b-b738-694a44d844da | e9a02a62-30f8-458b-8d78-d0cf44b0c659 | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-25T12:53:56.591Z |

## Integrated A2A Workbench Proof

No integrated A2A Workbench events were captured in the Langclaw order evidence. Use the partner proof below, or enable `LANGCLAW_A2A_WORKBENCH_ENABLED=true` for the next paid onchain smoke.

## A2A Partner Proof

| Field | Value |
| --- | --- |
| Capability | universal.workbench.agent |
| Requester agent ID | 2a3f94a2-1a57-4fd7-8bc0-dd4b67eef14a |
| Provider agent ID | 0ad53b08-34bf-47a3-870f-5be9eaca0262 |
| Service ID | a8f1c20d-73f4-4551-856a-32315e18d261 |
| Negotiation ID | bd1d7e11-ba87-431c-90a1-26111ed7d775 |
| Order ID | 82ce7de5-2875-4bb1-a935-ff477b3ef8bf |
| Order status | completed |
| Paid | true |
| Pay tx hash | 0x3537c50ef69596c899d4d81e456e5ada6a45144e0f014a622f1491a2b08163eb |
| Deliver tx hash | 0x4bd98fe2d0fbfe6e026b7dc6cb5a6eb3ca86dca19804508064b68782eeb441e4 |
| Delivery ID | 39afd3a4-7a37-466f-ae19-775a483240d0 |
| Delivery status | accepted |
| Delivery preview hash | b3283bf184bb082f364b8537776bc6b15fce2ff9f9acb3fb11ae87da394bfd4b |
| Generated at | 2026-06-25T11:00:40.225Z |

## Requester Proof

| Field | Value |
| --- | --- |
| Requester agent ID | Not captured in requester smoke summary. |
| Requester wallet | Not captured in requester smoke summary. |
| Service ID | Not captured in requester smoke summary. |
| Smoke negotiation ID | Not captured in requester smoke summary. |
| Smoke order ID | Not captured in requester smoke summary. |

## Anti-Sybil Notes

- Unique requester agents captured: 1.
- Unique requester wallets captured: 1.
- Use real requester agents and buyer wallets for final proof.
- Keep provider and requester keys separate.
- Do not use fake payments, self-trade loops, or synthetic order activity as reward evidence.
- Keep redacted logs available for random human audit.

## Commands

- `node --import tsx scripts/croo-a2a-workbench-smoke.ts`
- `node --import tsx scripts/croo-evidence-report.ts`

## Notes

- This report is generated from redacted local evidence files.
- It intentionally omits raw prompts, API keys, license tokens, private keys, and full delivery payloads.
