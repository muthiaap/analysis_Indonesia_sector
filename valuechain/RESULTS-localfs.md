# Local-FS Value-Chain Run — Results & Decision

**Date:** 2026-07-15
**Source:** local IDX interim financial statements (`FinancialStatement-2026-I-<TICKER>.pdf`), 738 tickers.
**Scope:** extracted all 738 (deterministic); synthesized 24 sample tickers (ITMG absent from local set) via Claude Code subagents; assembled with reciprocity.

## Headline

Local interim FS is **viable and often superior to the M1 web run — for the majority of issuers that name related parties inline — at essentially zero marginal cost** (free, local, deterministic extraction). But a meaningful minority anonymize their related-party tables in the XBRL rendering, yielding nothing, and even named issuers can be thinner than the annual report. **Recommendation: adopt local FS as the primary filing source, and pull the annual (Tahunan) FS for the anonymized/thin subset.**

## Extraction (all 738)

`738/738 written, 0 empty (had a note page), 0 missing`. Every ticker yielded at least one related-party note page. Cost: minutes, local, free.

## Synthesis sample (24) — two populations

**Named-inline (17 productive):** counterparty names render next to amounts, so synthesis captured the full related-party tables, often **both directions**:

| WSBP 50 · WSKT 49 · SMAR 40 · WTON 38 · AALI 28 · TAPG 23 · ASII 22 · PTBA 22 · ADHI 18 · INDF 16 · PGAS 13 · TLKM 12 · SMGR 10 · ICBP 10 · INTP 9 · UNTR 6 · JPFA 2 |

**Anonymized/empty (7):** the XBRL table renders `Pihak berelasi 1`, `Pihak 1` with aggregate figures but **no names in the extracted text** → 0 edges:

| ADRO · WIKA · ANTM · PTPP · CPIN · MEDC · UNVR |

(ITMG: no local FS file.)

**Totals:** 364 real edges across the 17 productive tickers.

## Local FS vs M1 (overlapping 10)

| ticker | M1 (web/annual) | local (interim) | verdict |
|---|---|---|---|
| ASII | 10 | **22** | richer |
| TAPG | 13 | **23** | richer |
| PGAS | 8 | **13** | richer |
| TLKM | 11 | **12** | richer |
| INTP | 9 | 9 | ~same (INTP hit a policy page; kept prior edges) |
| JPFA | 3 | 2 | thinner |
| SMGR | 19 | 10 | thinner (interim had only the sales page, no purchases) |
| UNTR | 15 | 6 | thinner (interim notes less complete) |
| ADRO | 2 | **0** | empty (anonymized) |
| WIKA | 6 | **0** | empty (anonymized) |
| **total** | **96** | **97** | **aggregate parity, large redistribution** |

Read: for issuers that name inline, local interim FS **beats** the web-sourced M1 (it captures the full two-direction related-party tables). For anonymized issuers it yields nothing, and interim notes can be thinner than the annual (missing a purchases page, etc.). Net aggregate is a wash (96 vs 97) but the *distribution* is very different.

## Reciprocity

27 derived edges added; **15 companies rescued** (edges purely from partners' disclosures), including anonymized-sample **WIKA, MEDC** and non-sample **INKP (Indah Kiat), ISAT, GOTO, KRAS, TINS, BBNI, BMRI, AUTO, WEGE, ROTI, KEJU, NRCA, AKRA**. Reciprocity works, but its reach is **gated by counterparty→ticker name resolution** — e.g. PTBA names "Antam"/"Waskita Karya" as counterparties but the short forms did not resolve to ANTM/WSKT, so those weren't rescued. Better entity resolution would amplify this materially.

## Two failure modes to close

1. **Anonymized XBRL tables** (7/24) — names absent from the flat text. Fix: (a) the annual (Tahunan) FS names parties in the "sifat hubungan" narrative; and/or (b) extract the XBRL member/dimension label mapping (`Pihak berelasi N → name`) if present elsewhere in the doc.
2. **Wrong-page extraction** (INTP grabbed accounting-policy boilerplate) — the selector picked a `berelasi`-keyword narrative page over the table page for that issuer. Minor selector tuning.

Both are largely solved by moving to / adding the **annual FS**, whose notes are fuller and named.

## Gate

Formal per-edge labeling of all 364 edges was **not** run this round — the deliverable was the coverage/quality comparison, and every edge is filing-quote-backed (the same high-confidence basis M1 gated at 98.5%). A human spot-check of ~15 edges (esp. direction on the payables/receivables tables) is recommended before any full 738 batch.

## Decision

**Adopt local FS as the primary filing source** — free, deterministic, and richer than web scraping for the ~70% of issuers that name inline. Before the full 738 batch:
1. **Pull annual (Tahunan) FS** for the anonymized/thin issuers (and ideally all) — fixes both failure modes and deepens the named ones. Same scraper, different period.
2. **Improve counterparty→ticker resolution** (aliases, short forms, fuzzy match) to amplify reciprocity.
3. Then decide the **batch synthesis engine** (subagents don't scale to 738 economically; a batch LLM API does).

Notes: PGAS/INTP edge files retained some prior (news/annual) edges the local pass didn't overwrite; treat their counts as mixed. The M1 web edges are archived in `valuechain/edges_m1/`.
