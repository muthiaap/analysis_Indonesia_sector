# Evidence Collection Contract (one company per subagent)

You research ONE Indonesian listed company and write an evidence bundle.
You do NOT decide relationships — you only gather sourced text.

## Input
`{ticker, legal_name, aliases, sector}` (from `vc_targets.load_targets`).

## What to collect (most authoritative first)
1. **filing** — the company's latest annual report / financial statements.
   Find the note sections that NAME counterparties: related-party transactions
   (transaksi pihak berelasi), revenue/customer concentration (pelanggan >10%),
   material contracts / offtake agreements. `source_date` = report period-end.
2. **company_site** — the company's own clients / partners / customers / suppliers
   page, if one exists.
3. **news / search** — queries in Indonesian AND English:
   "<legal_name> pemasok", "<legal_name> pelanggan utama", "<legal_name> offtake",
   "<legal_name> supplier", "<legal_name> kontrak pasok", "<legal_name> customer".
   Prefer results published within the last 24 months. Record each result's
   publication date as `source_date` (null only if genuinely undeterminable).

## Rules
- Copy the VERBATIM sentence(s) that mention a supplier/customer into `text`.
  Do not paraphrase — the synthesis step needs a real quote.
- Every snippet MUST have a real `source_url`.
- `source_type` is one of: filing | company_site | news | search.
- Aim for 5–20 snippets. Empty is acceptable if nothing is found — do not invent.

## Output — write to `valuechain/evidence/<TICKER>.json`
{
  "ticker": "<TICKER>",
  "collected_date": "<YYYY-MM-DD>",
  "snippets": [
    {"source_url": "...", "source_type": "filing",
     "source_date": "2025-03-31", "text": "<verbatim sentence>"}
  ]
}

Validate your file with:
`python3 -c "import json,vc_schema as s; print(s.validate_bundle(json.load(open('valuechain/evidence/<TICKER>.json'))))"`
An empty list `[]` means valid.
