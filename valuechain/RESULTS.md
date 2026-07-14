# Milestone-1 Results — External Value-Chain Edge Discovery

**Date:** 2026-07-14
**Seed (10):** ADRO, UNTR, ASII, SMGR, INTP, TLKM, TAPG, PGAS, WIKA, JPFA
**Pipeline:** 10 collection subagents → 10 synthesis subagents → `vc_assemble.py` → `vc_eval.py`

> **Labeling caveat (important):** The 85 edges were labeled by the AI controller
> (verification against each edge's cited quote), **not by an independent human**.
> The gate was designed around human judgment; AI-checking-AI is weaker evidence.
> Treat this result as **PROVISIONAL**. Recommended before any 738 batch: a human
> spot-checks ~10–15 edges (including the borderline ones listed below and a few
> `source_url`s for authenticity).

## Volumes

| Stage | Count |
|---|---|
| Evidence snippets collected | 122 |
| Edges synthesized | 96 |
| Edges kept after freshness + dedup | **85** |
| Dropped by 24-month freshness / dedup | 11 |
| Counterparties resolved to a listed ticker | 9 |

Per company (kept): ADRO 2, UNTR 15, ASII 10, SMGR 19, INTP 9, TLKM 11, TAPG 12, PGAS 3, WIKA 3, JPFA 1.

## Precision (AI-verified) & Gate

```
tier     correct/n   precision    source_types
high      64/65        98.5%      filing:65
medium    15/15       100.0%      company_site:5, news:5, filing:5
low        5/5        100.0%      company_site:5
GATE (high precision >= 85%): PASS -> proceed to batch
```

- The high tier is **100% filing-sourced** — the reliable core. The `source_type`
  breakdown shows no news mistyped as `filing` (the one gate soft-spot the final
  review flagged), so the freshness exemption was not abused.
- One edge marked **false**: `TLKM → GoTo (customer)`. Its quote is about
  Telkomsel's US$450M **equity investment** in GoTo plus vague "synergy," not a
  clear connectivity purchase — it fails the goods/services-flow test. (It is
  `high` confidence, so it is the single miss in the high tier.)

## Borderline edges a human should re-check

- **INTP → Heidelberg Materials AG / Asia (supplier):** "professional/management
  fees" to the parent — a real service flow but low value; a stricter rubric might
  exclude intra-group management fees.
- **WIKA → PT Angkasa Pura Indonesia (customer):** WIKA's own release states an
  "irrigation project (Belimbing)" owned by the airport operator — the counterparty
  + direction are supported, but the project description is anomalous.
- **SMGR position-inferred directions** (Topabiring, KA Logistik, PTBA, Krakatau
  Bandar Samudera, Artha Daya Coalindo): direction was inferred from table position;
  each counterparty's known business (logistics/coal) confirms `supplier`, but the
  quotes are bare number rows.
- **UNTR → 5 PAMA mining customers** (Bukit Asam, Indominco, Kideco, Kaltim Prima
  Coal, Jembayan): correct and real, but sourced from undated company-site text
  (rated `low`).

## Coverage / recall notes (honest limits)

- **Freshness is aggressive by design.** PGAS lost its PLN + several supplier edges
  and WIKA lost older-project edges because those relationships were only found in
  2020–2021 news (>24 months). Real relationships, but they don't meet the recency
  bar without a filing source. This is the recency guard working as specified — the
  cost is recall for well-known-but-old links.
- **Disclosure gaps confirmed the spec's premise.** JPFA's corn/soybean-meal
  suppliers are described only generically in filings, so none were named (1 edge
  kept). TAPG's smallholder ("petani plasma") FFB suppliers are unnamed.
- **Related-party disclosures carry most of the signal** — the high-precision core
  comes from Note-on-related-parties and major-customer (>10% revenue) tables.

## Inter-company graph (counterparty is itself a tracked ticker)

```
SMGR --customer--> WTON, ADHI, WSBP   (cement -> precast/contractor)
SMGR --supplier--> PTBA               (coal)
UNTR --customer--> ASII               (intra-Astra sales)
UNTR --customer--> PTBA               (PAMA mining services, low)
TAPG --customer--> SMAR               (CPO sales)
TLKM --customer--> ISAT, GOTO         (GOTO labeled false)
```

## Decision

**Gate passes provisionally (98.5% high-tier).** Recommended next step is a human
spot-check of the borderline edges above before committing search-API + batch-LLM
spend on the full 738 universe. If the human check holds, the layered pipeline is
validated for batch; the main scaling costs will be (a) collection breadth and
(b) a paid search API to replace the subagent web research.

### Suggested refinements before batch
1. Have synthesis prefer the external counterparty over intra-group management-fee
   edges, or tag management-fee edges separately so they can be filtered.
2. Consider raising the freshness window for **filing-corroborated** relationships,
   or add a "known-but-stale" tier, to recover recall on names like PGN↔PLN.
3. Add the `source_url`-resolves + quote-present authenticity check to `vc_eval`
   (mechanical) so a human only judges direction/reality.
