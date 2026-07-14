"""Cross-runtime validation for the language-neutral contract fixture."""

import json
from pathlib import Path
from typing import Any, cast

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "packages/schemas/contracts"
FIXTURES = ROOT / "packages/schemas/fixtures"


def load_json(path: Path) -> dict[str, Any]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return cast(dict[str, Any], document)


def test_contract_fixture_is_valid() -> None:
    validator = Draft202012Validator(
        load_json(CONTRACTS / "contract-fixture.v1.schema.json"),
        format_checker=FormatChecker(),
    )
    errors = sorted(
        validator.iter_errors(load_json(FIXTURES / "contract-fixture.v1.valid.json")),
        key=lambda error: list(error.path),
    )
    assert errors == []


def test_durable_synthetic_event_contract_fixtures() -> None:
    validator = Draft202012Validator(
        load_json(CONTRACTS / "durable.synthetic.requested.v1.schema.json"),
        format_checker=FormatChecker(),
    )

    valid_errors = list(
        validator.iter_errors(load_json(FIXTURES / "durable.synthetic.requested.v1.valid.json"))
    )
    assert valid_errors == []

    for name in (
        "durable.synthetic.requested.v1.invalid-actor.json",
        "durable.synthetic.requested.v1.invalid-payload.json",
        "durable.synthetic.requested.v1.unsupported-version.json",
    ):
        assert list(validator.iter_errors(load_json(FIXTURES / name))), name
