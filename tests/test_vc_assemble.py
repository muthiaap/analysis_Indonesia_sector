import json

from vc_assemble import (build_universe_index, resolve_counterparty_ticker,
                         assemble, add_reciprocity)

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


def _cust_edge(cp, cp_ticker):
    return {'counterparty': cp, 'counterparty_ticker': cp_ticker, 'direction': 'customer',
            'flow': 'cement sales', 'confidence': 'high', 'evidence_quote': 'sells to them',
            'source_url': 'u', 'source_type': 'filing', 'source_date': '2026-03-31',
            'retrieved_date': '2026-07-14'}


def test_reciprocity_adds_reverse_edge_for_tracked_counterparty():
    out = {'SMGR': {'company': 'Semen Indonesia (Persero) Tbk',
                    'edges': [_cust_edge('PT Wijaya Karya Beton Tbk', 'WTON')]}}
    add_reciprocity(out, {'WTON': 'Wijaya Karya Beton Tbk'})
    derived = [e for e in out['WTON']['edges'] if e.get('derived')]
    assert len(derived) == 1
    assert derived[0]['direction'] == 'supplier'          # customer -> supplier
    assert derived[0]['counterparty_ticker'] == 'SMGR'
    assert derived[0]['via'] == 'SMGR'
    assert derived[0]['confidence'] == 'high'


def test_reciprocity_real_edge_wins_over_derived():
    out = {
        'SMGR': {'company': 'Semen Indonesia', 'edges': [_cust_edge('PT Wijaya Karya Beton Tbk', 'WTON')]},
        'WTON': {'company': 'Wijaya Karya Beton Tbk', 'edges': [
            {'counterparty': 'Semen Indonesia', 'counterparty_ticker': 'SMGR', 'direction': 'supplier',
             'flow': 'buys cement', 'confidence': 'high', 'evidence_quote': 'buys from SMGR',
             'source_url': 'u', 'source_type': 'filing', 'source_date': '2026-03-31', 'retrieved_date': '2026-07-14'}]},
    }
    add_reciprocity(out, {'WTON': 'Wijaya Karya Beton Tbk', 'SMGR': 'Semen Indonesia'})
    assert [e for e in out['WTON']['edges'] if e.get('derived')] == []   # real covers it


def test_no_reciprocity_for_unlisted_counterparty():
    out = {'ADRO': {'company': 'Alamtri', 'edges': [_cust_edge('TNB Fuel Services', None)]}}
    add_reciprocity(out, {})
    assert list(out.keys()) == ['ADRO']
