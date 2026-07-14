"""Shape checks for evidence bundles and synthesized edges."""

DIRECTIONS = {'supplier', 'customer'}
CONFIDENCES = {'high', 'medium', 'low'}
SOURCE_TYPES = {'filing', 'news', 'search', 'company_site'}
EDGE_FIELDS = ['counterparty', 'counterparty_ticker', 'direction', 'flow',
               'confidence', 'evidence_quote', 'source_url', 'source_type',
               'source_date', 'retrieved_date']

_REQUIRED_NONEMPTY = ['counterparty', 'direction', 'flow', 'confidence',
                      'evidence_quote', 'source_url', 'source_type']


def validate_edge(edge: dict) -> list[str]:
    errors = []
    for f in _REQUIRED_NONEMPTY:
        if not edge.get(f):
            errors.append(f'missing {f}')
    if edge.get('direction') not in DIRECTIONS:
        errors.append(f'bad direction: {edge.get("direction")!r}')
    if edge.get('confidence') not in CONFIDENCES:
        errors.append(f'bad confidence: {edge.get("confidence")!r}')
    if edge.get('source_type') not in SOURCE_TYPES:
        errors.append(f'bad source_type: {edge.get("source_type")!r}')
    q = edge.get('evidence_quote') or ''
    if q and len(q.strip()) < 10:
        errors.append(f'quote too short: {q!r}')
    return errors


def validate_bundle(bundle: dict) -> list[str]:
    errors = []
    if not bundle.get('ticker'):
        errors.append('missing ticker')
    snippets = bundle.get('snippets')
    if not isinstance(snippets, list) or not snippets:
        errors.append('no snippets')
        return errors
    for i, s in enumerate(snippets):
        if not isinstance(s, dict):
            errors.append(f'snippet {i} is not an object')
            continue
        if not s.get('source_url'):
            errors.append(f'snippet {i} missing source_url')
        if s.get('source_type') not in SOURCE_TYPES:
            errors.append(f'snippet {i} bad source_type')
        if not s.get('text'):
            errors.append(f'snippet {i} missing text')
    return errors
