import json

from vc_assemble import (build_universe_index, resolve_counterparty_ticker,
                         assemble)

RUN = '2026-07-14'


def _edge(cp, direction='customer', conf='high',
          stype='filing', sdate='2025-03-31'):
    return {'counterparty': cp, 'counterparty_ticker': None,
            'direction': direction, 'flow': 'x', 'confidence': conf,
            'evidence_quote': 'a sufficiently long quote', 'source_url': 'u',
            'source_type': stype, 'source_date': sdate,
            'retrieved_date': RUN}


def test_resolve_counterparty_matches_by_normalized_name():
    index = {'united tractors': 'UNTR'}
    assert resolve_counterparty_ticker('PT United Tractors Tbk.', index) == 'UNTR'
    assert resolve_counterparty_ticker('Nonlisted Vendor', index) is None


def test_assemble_dedupes_same_counterparty_direction(tmp_path):
    f = tmp_path / 'ADRO.json'
    f.write_text(json.dumps({'ticker': 'ADRO', 'company': 'Adaro', 'edges': [
        _edge('PT PLN (Persero)'),
        _edge('PLN'),                    # same counterparty, same direction
    ]}))
    out = assemble([f], RUN, {})
    assert len(out['ADRO']['edges']) == 1


def test_assemble_drops_stale_and_resolves_ticker(tmp_path):
    f = tmp_path / 'ADRO.json'
    f.write_text(json.dumps({'ticker': 'ADRO', 'company': 'Adaro', 'edges': [
        _edge('PT United Tractors Tbk.', stype='news', sdate='2020-01-01'),  # stale -> drop
        _edge('PT United Tractors Tbk.', direction='supplier'),              # filing -> keep
    ]}))
    out = assemble([f], RUN, {'united tractors': 'UNTR'})
    edges = out['ADRO']['edges']
    assert len(edges) == 1
    assert edges[0]['direction'] == 'supplier'
    assert edges[0]['counterparty_ticker'] == 'UNTR'


def test_build_universe_index_is_nonempty_and_maps_names():
    index = build_universe_index()
    assert len(index) > 100
    # every value is a ticker string
    assert all(isinstance(v, str) and v for v in index.values())
