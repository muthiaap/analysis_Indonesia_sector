"""Canonical company-name form for dedup and counterparty resolution."""
import re

# Legal-form and status words that carry no identity.
_STOP = re.compile(r'\b(pt|tbk|persero|perseroan|terbuka)\b')


def normalize_name(name: str) -> str:
    """Lowercase, drop punctuation and legal-form words, collapse whitespace.
    'PT Adaro Energy Indonesia Tbk.' -> 'adaro energy indonesia'."""
    s = name.lower()
    s = re.sub(r'[^a-z0-9\s]', ' ', s)   # punctuation -> space
    s = _STOP.sub(' ', s)
    return re.sub(r'\s+', ' ', s).strip()
