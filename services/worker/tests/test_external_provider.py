import pytest
from cumulore_worker.external_provider import (
    DeterministicFakeProvider,
    NonRepeatableFakeProvider,
    require_safe_provider,
)


def test_fake_provider_deduplicates_confirmed_invocation() -> None:
    provider = DeterministicFakeProvider()

    first = provider.invoke("key-1", "confirmed_success")
    second = provider.invoke("key-1", "confirmed_success")

    assert first == second
    assert provider.invocation_count == 1


def test_unknown_invocation_reconciles_to_success() -> None:
    provider = DeterministicFakeProvider()

    assert provider.invoke("key-2", "unknown_then_success").outcome == "unknown"
    result = provider.reconcile("key-2")

    assert result.outcome == "succeeded"
    assert result.provider_reference == "fake-reconciled-key-2"


def test_non_repeatable_provider_is_rejected() -> None:
    with pytest.raises(RuntimeError, match="lacks idempotency"):
        require_safe_provider(NonRepeatableFakeProvider())
