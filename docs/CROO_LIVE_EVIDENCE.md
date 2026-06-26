# CROO Live Evidence

Generated at: 2026-06-26T10:39:57.459Z

## Summary

- Completed order count: 3
- Unique requester agent count: 1
- Unique requester wallet count: 1
- Failed lifecycle event count: 2
- A2A partner completed order count: 0
- Integrated A2A Workbench completed order count: 1
- Evidence log: `data/croo-order-evidence.jsonl`
- Requester smoke summary: `data/croo-requester-smoke.json`
- A2A Workbench smoke summary: `data/croo-a2a-workbench-smoke.json`

## Completed Orders

| Order ID | Negotiation ID | Service ID | Capability | Settlement | Delivery Hash | Sources | Timestamp |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4f98b45e-fc2c-42e3-bd85-1a8ea437109f | 7106481a-d1c9-4b3d-b105-c4bcdff58ec6 | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | d3bee3bbbd8858243539b1c90b37afcd0a59c5a7aa9bc34e58c6eda63f4ce611 | 5 | 2026-06-25T12:10:02.697Z |
| 8cb935c7-b198-4da9-8f31-06c349a89545 | c7cfb537-404f-451b-bffe-3c32aebb2167 | 70b7b5d4-961b-47ba-97c6-a863b1c949c0 | langclaw.builder.pass.license |  |  |  | 2026-06-25T12:48:15.678Z |
| 4ce04e93-f724-40f7-b3f0-394830c9c4f3 | f03471b3-4ce0-4dc9-b473-b753496dae5c | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | fad04de1e68a8ea02b3c8edccb6bae74b754293bea9925751caa7c1614655bbc | 4 | 2026-06-26T10:36:18.137Z |

## Lifecycle Events

| Stage | Order ID | Negotiation ID | Service ID | Capability | Settlement | Timestamp |
| --- | --- | --- | --- | --- | --- | --- |
| negotiation_created |  | 7106481a-d1c9-4b3d-b105-c4bcdff58ec6 | 9307e592-7a95-4679-9152-300fd052e614 |  | escrow | 2026-06-25T11:59:19.960Z |
| negotiation_accepted |  | 7106481a-d1c9-4b3d-b105-c4bcdff58ec6 | 9307e592-7a95-4679-9152-300fd052e614 |  | escrow | 2026-06-25T11:59:25.095Z |
| order_paid | 4f98b45e-fc2c-42e3-bd85-1a8ea437109f | 7106481a-d1c9-4b3d-b105-c4bcdff58ec6 | 9307e592-7a95-4679-9152-300fd052e614 |  |  | 2026-06-25T12:00:20.545Z |
| order_failed | 4f98b45e-fc2c-42e3-bd85-1a8ea437109f | 7106481a-d1c9-4b3d-b105-c4bcdff58ec6 | 9307e592-7a95-4679-9152-300fd052e614 |  |  | 2026-06-25T12:00:24.651Z |
| order_paid | 4f98b45e-fc2c-42e3-bd85-1a8ea437109f | 7106481a-d1c9-4b3d-b105-c4bcdff58ec6 | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-25T12:09:32.056Z |
| order_delivered | 4f98b45e-fc2c-42e3-bd85-1a8ea437109f | 7106481a-d1c9-4b3d-b105-c4bcdff58ec6 | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-25T12:10:02.697Z |
| negotiation_created |  | e9a02a62-30f8-458b-8d78-d0cf44b0c659 | 9307e592-7a95-4679-9152-300fd052e614 |  | escrow | 2026-06-25T12:46:25.380Z |
| negotiation_accepted |  | e9a02a62-30f8-458b-8d78-d0cf44b0c659 | 9307e592-7a95-4679-9152-300fd052e614 |  | escrow | 2026-06-25T12:46:30.637Z |
| negotiation_created |  | c7cfb537-404f-451b-bffe-3c32aebb2167 | 70b7b5d4-961b-47ba-97c6-a863b1c949c0 | langclaw.builder.pass.license | escrow | 2026-06-25T12:47:08.309Z |
| negotiation_accepted |  | c7cfb537-404f-451b-bffe-3c32aebb2167 | 70b7b5d4-961b-47ba-97c6-a863b1c949c0 | langclaw.builder.pass.license | escrow | 2026-06-25T12:47:13.958Z |
| order_paid | cb2ba2fa-9258-425b-b738-694a44d844da | e9a02a62-30f8-458b-8d78-d0cf44b0c659 | 9307e592-7a95-4679-9152-300fd052e614 |  |  | 2026-06-25T12:47:28.324Z |
| order_failed | cb2ba2fa-9258-425b-b738-694a44d844da | e9a02a62-30f8-458b-8d78-d0cf44b0c659 | 9307e592-7a95-4679-9152-300fd052e614 |  |  | 2026-06-25T12:47:31.741Z |
| order_paid | 8cb935c7-b198-4da9-8f31-06c349a89545 | c7cfb537-404f-451b-bffe-3c32aebb2167 | 70b7b5d4-961b-47ba-97c6-a863b1c949c0 | langclaw.builder.pass.license |  | 2026-06-25T12:48:10.272Z |
| order_delivered | 8cb935c7-b198-4da9-8f31-06c349a89545 | c7cfb537-404f-451b-bffe-3c32aebb2167 | 70b7b5d4-961b-47ba-97c6-a863b1c949c0 | langclaw.builder.pass.license |  | 2026-06-25T12:48:15.678Z |
| negotiation_created |  | f03471b3-4ce0-4dc9-b473-b753496dae5c | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence | escrow | 2026-06-26T10:32:31.559Z |
| negotiation_accepted |  | f03471b3-4ce0-4dc9-b473-b753496dae5c | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence | escrow | 2026-06-26T10:32:36.519Z |
| order_paid | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 | f03471b3-4ce0-4dc9-b473-b753496dae5c | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-26T10:33:34.191Z |
| a2a_workbench_negotiation_created | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 |  | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-26T10:36:13.159Z |
| a2a_workbench_order_paid | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 |  | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-26T10:36:13.161Z |
| a2a_workbench_delivery_received | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 |  | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-26T10:36:13.164Z |
| order_delivered | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 | f03471b3-4ce0-4dc9-b473-b753496dae5c | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-26T10:36:18.137Z |
| order_recovered | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 | f03471b3-4ce0-4dc9-b473-b753496dae5c | 9307e592-7a95-4679-9152-300fd052e614 | langclaw.onchain.intelligence |  | 2026-06-26T10:37:04.852Z |

## Integrated A2A Workbench Proof

| Stage | Langclaw Order ID | Workbench Negotiation ID | Workbench Order ID | Workbench Service ID | Provider Agent ID | Delivery Hash | Timestamp |
| --- | --- | --- | --- | --- | --- | --- | --- |
| a2a_workbench_negotiation_created | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 | d2ac4ea0-e5c6-4209-b947-cfe06112df35 |  | a8f1c20d-73f4-4551-856a-32315e18d261 | 0ad53b08-34bf-47a3-870f-5be9eaca0262 |  | 2026-06-26T10:36:13.159Z |
| a2a_workbench_order_paid | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 | d2ac4ea0-e5c6-4209-b947-cfe06112df35 | 745c730b-5ee6-4d8e-9556-3ff0844c02ce | a8f1c20d-73f4-4551-856a-32315e18d261 | 0ad53b08-34bf-47a3-870f-5be9eaca0262 |  | 2026-06-26T10:36:13.161Z |
| a2a_workbench_delivery_received | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 | d2ac4ea0-e5c6-4209-b947-cfe06112df35 | 745c730b-5ee6-4d8e-9556-3ff0844c02ce | a8f1c20d-73f4-4551-856a-32315e18d261 | 0ad53b08-34bf-47a3-870f-5be9eaca0262 | 0x48dea8ec566f4e0cec45574470dec4286bbdad5a380cf1cc42929552352e44a9 | 2026-06-26T10:36:13.164Z |

## A2A Partner Proof

| Field | Value |
| --- | --- |
| Capability | Not captured in standalone A2A smoke summary. |
| Requester agent ID | Not captured in standalone A2A smoke summary. |
| Provider agent ID | Not captured in standalone A2A smoke summary. |
| Service ID | Not captured in standalone A2A smoke summary. |
| Negotiation ID | Not captured in standalone A2A smoke summary. |
| Order ID | Not captured in standalone A2A smoke summary. |
| Order status | Not captured in standalone A2A smoke summary. |
| Paid | Not captured in standalone A2A smoke summary. |
| Pay tx hash | Not captured in standalone A2A smoke summary. |
| Deliver tx hash | Not captured in standalone A2A smoke summary. |
| Delivery ID | Not captured in standalone A2A smoke summary. |
| Delivery status | Not captured in standalone A2A smoke summary. |
| Delivery preview hash | Not captured in standalone A2A smoke summary. |
| Generated at | Not captured in standalone A2A smoke summary. |

## Requester Proof

| Field | Value |
| --- | --- |
| Requester agent ID | b73b523e-7f72-47da-ad83-52e9b1cb62a1 |
| Requester wallet | 0x2922bA9856855Dc209A5d3972f93C8eaD773a81c |
| Service ID | 9307e592-7a95-4679-9152-300fd052e614 |
| Smoke negotiation ID | f03471b3-4ce0-4dc9-b473-b753496dae5c |
| Smoke order ID | 4ce04e93-f724-40f7-b3f0-394830c9c4f3 |

## Anti-Sybil Notes

- Unique requester agents captured: 1.
- Unique requester wallets captured: 1.
- Use real requester agents and buyer wallets for final proof.
- Keep provider and requester keys separate.
- Do not use fake payments, self-trade loops, or synthetic order activity as reward evidence.
- Keep redacted logs available for random human audit.

## Commands

- `node --import tsx scripts/croo-requester-smoke.ts`
- `node --import tsx scripts/croo-evidence-report.ts`

## Notes

- This report is generated from redacted local evidence files.
- It intentionally omits raw prompts, API keys, license tokens, private keys, and full delivery payloads.
