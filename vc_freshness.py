"""Recency window and confidence disposition for evidence-backed edges."""
from datetime import date

WINDOW_MONTHS = 24
_FILING_TYPES = {'filing'}
_CONF = {'low': 0, 'medium': 1, 'high': 2}
_CONF_INV = {0: 'low', 1: 'medium', 2: 'high'}


def _parse(d: str) -> date:
    """Accept 'YYYY', 'YYYY-MM', or 'YYYY-MM-DD'."""
    p = d.split('-')
    y = int(p[0])
    m = int(p[1]) if len(p) > 1 else 1
    day = int(p[2]) if len(p) > 2 else 1
    return date(y, m, day)


def _minus_months(d: date, months: int) -> date:
    y = d.year - months // 12
    m = d.month - months % 12
    if m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1)


def in_window(source_date, run_date: str, window_months: int = WINDOW_MONTHS) -> bool:
    if not source_date:
        return False
    cutoff = _minus_months(_parse(run_date), window_months)
    return _parse(source_date) >= cutoff


def evidence_status(source_type, source_date, run_date,
                    window_months: int = WINDOW_MONTHS) -> str:
    if source_type in _FILING_TYPES:
        return 'fresh'
    if not source_date:
        return 'undated'
    return 'fresh' if in_window(source_date, run_date, window_months) else 'stale'


def cap_confidence(conf: str, ceiling: str) -> str:
    return _CONF_INV[min(_CONF[conf], _CONF[ceiling])]


def apply_freshness(edge: dict, run_date: str,
                    window_months: int = WINDOW_MONTHS):
    """Drop stale-only edges; cap undated-web edges at 'low'; keep the rest."""
    status = evidence_status(edge['source_type'], edge.get('source_date'),
                             run_date, window_months)
    if status == 'stale':
        return None
    out = dict(edge)
    if status == 'undated':
        out['confidence'] = cap_confidence(out['confidence'], 'low')
    return out
