from vc_eval import edge_id, precision_by_tier, gate


def test_edge_id_is_stable_across_name_variants():
    a = edge_id('ADRO', 'PT PLN (Persero)', 'customer')
    b = edge_id('ADRO', 'PLN', 'customer')
    assert a == b


def test_precision_by_tier_counts_and_ratios():
    rows = [
        {'confidence': 'high', 'correct': True},
        {'confidence': 'high', 'correct': True},
        {'confidence': 'high', 'correct': False},
        {'confidence': 'low', 'correct': False},
    ]
    tiers = precision_by_tier(rows)
    assert tiers['high']['n'] == 3
    assert tiers['high']['correct'] == 2
    assert abs(tiers['high']['precision'] - 2 / 3) < 1e-9
    assert tiers['low']['precision'] == 0.0


def test_gate_requires_high_tier_at_or_above_threshold():
    assert gate({'high': {'n': 10, 'precision': 0.9}}) is True
    assert gate({'high': {'n': 10, 'precision': 0.8}}) is False
    assert gate({'high': {'n': 0, 'precision': 0.0}}) is False   # no evidence
    assert gate({}) is False
