"""Reads an extractor skill file from gym-skill-extract. Since schema v0.1 the records sit in an
envelope ({"schema_version", "code", ..., "records": [...]}); older copies are a bare list.
Both shapes are accepted, so a file copied from either version builds the same data."""
import json


def records(path):
    data = json.load(open(path, encoding="utf-8"))
    if isinstance(data, dict):
        return data["records"]
    return data
