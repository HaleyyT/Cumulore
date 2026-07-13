"""Cross-runtime validation for the language-neutral contract fixture."""

import json
from pathlib import Path
from typing import Any, cast

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "packages/schemas/contracts/contract-fixture.v1.schema.json"
FIXTURE_PATH = ROOT / "packages/schemas/fixtures/contract-fixture.v1.valid.json"


def load_json(path: Path) -> dict[str, Any]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return cast(dict[str, Any], document)


def test_contract_fixture_is_valid() -> None:
    validator = Draft202012Validator(load_json(SCHEMA_PATH), format_checker=FormatChecker())
    errors = sorted(
        validator.iter_errors(load_json(FIXTURE_PATH)), key=lambda error: list(error.path)
    )
    assert errors == []
