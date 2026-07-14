from vc_targets import SEED_TICKERS, build_aliases, load_targets


def test_seed_has_ten_expected_tickers():
    assert SEED_TICKERS == ['ADRO', 'UNTR', 'ASII', 'SMGR', 'INTP',
                            'TLKM', 'TAPG', 'PGAS', 'WIKA', 'JPFA']


def test_build_aliases_includes_legal_titlecase_and_ticker():
    aliases = build_aliases('PT Adaro Energy Indonesia Tbk.', 'ADRO')
    assert 'PT Adaro Energy Indonesia Tbk.' in aliases
    assert 'Adaro Energy Indonesia' in aliases
    assert 'ADRO' in aliases


def test_build_aliases_dedupes_and_drops_empty():
    aliases = build_aliases('ADRO', 'ADRO')
    assert aliases.count('ADRO') == 1
    assert '' not in aliases


def test_load_targets_defaults_to_seed_and_carries_sector():
    targets = load_targets()
    assert [t['ticker'] for t in targets] == SEED_TICKERS
    adro = next(t for t in targets if t['ticker'] == 'ADRO')
    assert adro['legal_name']            # non-empty from anak_perusahaan.json
    assert adro['sector']                # non-empty from all_lk.csv
    assert 'ADRO' in adro['aliases']
