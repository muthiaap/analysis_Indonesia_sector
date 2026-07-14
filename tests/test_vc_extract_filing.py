from vc_extract_filing import select_note_pages


def test_selects_related_party_table_page_not_narrative():
    pages = [
        "General information\nEntity name PT Example Tbk",
        "Kebijakan akuntansi atas transaksi pihak berelasi dijelaskan sebagai berikut.",  # narrative, no rows
        ("Rincian saldo dengan pihak berelasi\n"
         "Pihak berelasi 1 PT Wijaya Karya Beton Tbk 17,983 Related party 1\n"
         "Pihak berelasi 2 PT Adhi Karya (Persero) Tbk 22,284 Related party 2"),        # rp + rows
        "Catatan lain tanpa relevansi apa pun di sini",
    ]
    assert select_note_pages(pages) == [2]


def test_includes_adjacent_continuation_rows_page():
    pages = [
        ("Transaksi pihak berelasi\n"
         "Pihak berelasi 1 PT Alpha 10,000\nPihak berelasi 2 PT Beta 5,000"),           # rp + rows (kept)
        "PT Gamma Tbk 3,000\nPT Delta 1,200\nPT Epsilon 900",                            # continuation rows, no keyword
        "Halaman lain",
    ]
    assert select_note_pages(pages) == [0, 1]


def test_selects_concentration_page():
    pages = [
        "Konsentrasi risiko: pelanggan yang melebihi 10% dari pendapatan adalah PT Buyer Satu.",
        "Halaman biasa",
    ]
    assert select_note_pages(pages) == [0]


def test_empty_and_no_matches():
    assert select_note_pages([]) == []
    assert select_note_pages(["nothing here", "still nothing"]) == []


def test_fallback_keeps_related_party_pages_when_no_rows_detected():
    pages = ["Pengungkapan pihak berelasi tanpa tabel terstruktur di halaman ini."]
    assert select_note_pages(pages) == [0]


def test_selects_foreign_named_related_party_table():
    pages = [
        ("Transaksi pihak berelasi\n"
         "Related party 1 TNB Fuel Services Sdn. Bhd. 996,716\n"
         "Related party 2 Toyota Motor Corporation 1,234"),
    ]
    assert select_note_pages(pages) == [0]


def test_build_bundle_produces_schema_valid_bundle():
    import vc_schema as s
    from vc_extract_filing import build_bundle
    pages = ["intro",
             ("Transaksi pihak berelasi\n"
              "Related party 1 PT Alpha 10,000\nRelated party 2 PT Beta 5,000")]
    b = build_bundle('SMGR', pages, 'http://x')
    assert s.validate_bundle(b) == []
    assert b['snippets'][0]['source_type'] == 'filing'
    assert b['snippets'][0]['source_date'] == '2026-03-31'


def test_build_bundle_empty_when_no_note_pages():
    from vc_extract_filing import build_bundle
    b = build_bundle('ZZZZ', ['nothing here', 'still nothing'], 'http://x')
    assert b['snippets'] == []
