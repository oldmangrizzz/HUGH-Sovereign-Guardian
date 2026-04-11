"""Kuzu 0.7+ compatibility helpers."""

def kfetch(result) -> list:
    """Replacement for missing .fetchall() in Kuzu 0.7+ QueryResult."""
    rows = []
    while result.has_next():
        rows.append(result.get_next())
    return rows
