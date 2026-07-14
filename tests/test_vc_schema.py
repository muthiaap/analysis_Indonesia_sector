from vc_schema import validate_edge, validate_bundle


def _good_edge():
    return {
        'counterparty': 'PT PLN (Persero)',
        'counterparty_ticker': None,
        'direction': 'customer',
        'flow': 'thermal coal offtake',
        'confidence': 'high',
        'evidence_quote': 'perusahaan memasok batubara ke PLN',
        'source_url': 'https://example.com/report',
        'source_type': 'filing',
        'source_date': '2025-03-31',
        'retrieved_date': '2026-07-14',
    }


def test_good_edge_has_no_errors():
    assert validate_edge(_good_edge()) == []


def test_bad_direction_is_flagged():
    e = _good_edge(); e['direction'] = 'sideways'
    assert any('direction' in x for x in validate_edge(e))


def test_missing_quote_is_flagged():
    e = _good_edge(); e['evidence_quote'] = ''
    assert any('evidence_quote' in x for x in validate_edge(e))


def test_trivial_quote_is_flagged():
    e = _good_edge(); e['evidence_quote'] = 'ok'
    assert any('quote' in x for x in validate_edge(e))


def _good_bundle():
    return {'ticker': 'ADRO', 'collected_date': '2026-07-14', 'snippets': [
        {'source_url': 'https://x', 'source_type': 'news',
         'source_date': '2025-01-01', 'text': 'some evidence text here'}]}


def test_good_bundle_has_no_errors():
    assert validate_bundle(_good_bundle()) == []


def test_bundle_without_snippets_is_flagged():
    b = _good_bundle(); b['snippets'] = []
    assert any('snippet' in x.lower() for x in validate_bundle(b))
