from uuid import UUID

import pytest
from cumulore_worker.external_provider import (
    DeterministicFakeProvider,
    NonRepeatableFakeProvider,
    fake_provider_key,
    require_safe_provider,
)

LOGICAL_OPERATION_ID = UUID("00000000-0000-0000-0000-000000000001")


def test_fake_provider_deduplicates_confirmed_invocation() -> None:
    provider = DeterministicFakeProvider()

    first = provider.invoke("key-1", "confirmed_success")
    second = provider.invoke("key-1", "confirmed_success")

    assert first == second
    assert provider.invocation_count == 1


def test_unknown_invocation_reconciles_to_success() -> None:
    executor_provider = DeterministicFakeProvider()
    provider_key = fake_provider_key(
        LOGICAL_OPERATION_ID,
        "unknown_then_success",
    )

    assert executor_provider.invoke(provider_key, "unknown_then_success").outcome == "unknown"
    result = DeterministicFakeProvider().reconcile(provider_key)

    assert result.outcome == "succeeded"
    assert result.provider_reference == f"fake-reconciled-{provider_key}"


def test_provider_key_cannot_be_reused_with_different_input() -> None:
    provider = DeterministicFakeProvider()
    provider.invoke("key-3", "confirmed_success")

    with pytest.raises(RuntimeError, match="different input"):
        provider.invoke("key-3", "confirmed_failure")


def test_provider_key_is_stable_across_retry_generations() -> None:
    first = fake_provider_key(LOGICAL_OPERATION_ID, "confirmed_failure")
    retried = fake_provider_key(LOGICAL_OPERATION_ID, "confirmed_failure")

    assert first == retried


def test_non_repeatable_provider_is_rejected() -> None:
    with pytest.raises(RuntimeError, match="lacks idempotency"):
        require_safe_provider(NonRepeatableFakeProvider())
