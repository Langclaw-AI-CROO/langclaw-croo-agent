# CROO Live Evidence

Generated at: 2026-06-25T11:00:47.562Z

## Summary

- Completed order count: 0
- Unique requester agent count: 1
- Unique requester wallet count: 1
- Failed lifecycle event count: 0
- A2A partner completed order count: 1
- Evidence log: `data/croo-order-evidence.jsonl`
- Requester smoke summary: `data/croo-requester-smoke.json`
- A2A Workbench smoke summary: `data/croo-a2a-workbench-smoke.json`

## Completed Orders

| Order ID | Negotiation ID | Service ID | Capability | Settlement | Delivery Hash | Sources | Timestamp |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |

## Lifecycle Events

| Stage | Order ID | Negotiation ID | Service ID | Capability | Settlement | Timestamp |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

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
| Requester agent ID |  |
| Requester wallet |  |
| Service ID |  |
| Smoke negotiation ID |  |
| Smoke order ID |  |

## Commands

- `node --import tsx scripts/croo-a2a-workbench-smoke.ts`
- `node --import tsx scripts/croo-evidence-report.ts`

## Notes

- This report is generated from redacted local evidence files.
- It intentionally omits raw prompts, API keys, license tokens, private keys, and full delivery payloads.
