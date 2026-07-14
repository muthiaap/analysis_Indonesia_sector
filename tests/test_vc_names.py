from vc_names import normalize_name


def test_strips_pt_tbk_and_punctuation():
    assert normalize_name('PT Adaro Energy Indonesia Tbk.') == 'adaro energy indonesia'


def test_strips_persero_parenthetical():
    assert normalize_name('PT PLN (Persero)') == 'pln'


def test_collapses_whitespace_and_lowercases():
    assert normalize_name('  Mulia   Industrindo  Tbk ') == 'mulia industrindo'


def test_empty_stays_empty():
    assert normalize_name('') == ''
