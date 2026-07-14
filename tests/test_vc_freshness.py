from vc_freshness import (in_window, evidence_status, cap_confidence,
                          apply_freshness)

RUN = '2026-07-14'   # window default 24 months -> cutoff 2024-07-01


def test_in_window_boundaries():
    assert in_window('2024-08-01', RUN) is True
    assert in_window('2024-06-01', RUN) is False   # before cutoff
    assert in_window(None, RUN) is False


def test_evidence_status_filing_always_fresh_even_if_old():
    assert evidence_status('filing', '2019-01-01', RUN) == 'fresh'


def test_evidence_status_web():
    assert evidence_status('news', '2025-01-01', RUN) == 'fresh'
    assert evidence_status('news', '2020-01-01', RUN) == 'stale'
    assert evidence_status('news', None, RUN) == 'undated'


def test_cap_confidence_lowers_only_when_above_ceiling():
    assert cap_confidence('high', 'low') == 'low'
    assert cap_confidence('low', 'medium') == 'low'


def _edge(**kw):
    base = {'counterparty': 'X', 'direction': 'customer', 'flow': 'f',
            'confidence': 'high', 'evidence_quote': 'a long enough quote',
            'source_url': 'u', 'source_type': 'news', 'source_date': '2025-01-01'}
    base.update(kw)
    return base


def test_fresh_web_edge_kept_unchanged():
    e = apply_freshness(_edge(), RUN)
    assert e is not None and e['confidence'] == 'high'


def test_stale_web_edge_dropped():
    assert apply_freshness(_edge(source_date='2020-01-01'), RUN) is None


def test_undated_web_edge_capped_to_low():
    e = apply_freshness(_edge(source_date=None), RUN)
    assert e is not None and e['confidence'] == 'low'


def test_old_filing_edge_kept_unchanged():
    e = apply_freshness(_edge(source_type='filing', source_date='2019-01-01',
                              confidence='high'), RUN)
    assert e is not None and e['confidence'] == 'high'
