# Edge Synthesis Contract (one company per subagent)

You convert ONE company's evidence bundle into value-chain edges.

## Input
`valuechain/evidence/<TICKER>.json` (produced by the collection contract).

## The one hard rule
Emit an edge ONLY if a VERBATIM quote in the evidence supports it.
No quote → no edge. You may use outside knowledge only to normalize a
counterparty's name, NEVER to assert a relationship.

## Per edge
- `counterparty` — the other company's name as written.
- `direction` — `supplier` (flows INTO this company) or `customer` (flows OUT).
- `flow` — short phrase for what moves (e.g. "thermal coal offtake").
- `evidence_quote` — the verbatim supporting sentence from a snippet.
- `source_url`, `source_type`, `source_date` — copied from that snippet.
- `confidence`:
  - `high` = explicit disclosure/contract (filing) or an unambiguous named contract.
  - `medium` = credible named news within the window.
  - `low` = single weak/inferred source, OR web evidence with no `source_date`.
- If multiple snippets support one edge, pick the SINGLE best: prefer filing >
  fresh news > undated. (Stale-only edges are dropped downstream — don't rely on them.)
- `counterparty_ticker`: leave `null` (assembly resolves it).
- `retrieved_date`: the bundle's `collected_date`.

## Output — write a list under `valuechain/edges/<TICKER>.json`
{
  "ticker": "<TICKER>",
  "company": "<legal_name>",
  "edges": [ { ...edge fields... } ]
}

Validate every edge with:
`python3 -c "import json,vc_schema as s; d=json.load(open('valuechain/edges/<TICKER>.json'));
print([e for x in d['edges'] for e in [s.validate_edge(x)] if e])"`
An empty list means all edges are valid.
