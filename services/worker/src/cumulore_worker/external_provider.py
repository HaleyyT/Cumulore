"""Deterministic external-provider boundary used by Milestone 1C tests."""

from dataclasses import dataclass
from typing import Literal, Protocol
from uuid import UUID

Scenario = Literal[
    "confirmed_success",
    "confirmed_failure",
    "unknown_then_success",
    "no_idempotency",
]


@dataclass(frozen=True)
class ProviderResult:
    outcome: Literal["succeeded", "failed", "unknown"]
    provider_reference: str | None = None
    error_code: str | None = None


class ExternalProvider(Protocol):
    supports_idempotency: bool
    supports_reconciliation: bool

    def invoke(self, provider_key: str, scenario: Scenario) -> ProviderResult: ...

    def reconcile(self, provider_key: str) -> ProviderResult: ...


class DeterministicFakeProvider:
    """A process-independent fake with no network calls and repeat-safe keys."""

    supports_idempotency = True
    supports_reconciliation = True

    def __init__(self) -> None:
        self._invocations: dict[str, tuple[Scenario, ProviderResult]] = {}
        self.invocation_count = 0

    def invoke(self, provider_key: str, scenario: Scenario) -> ProviderResult:
        existing = self._invocations.get(provider_key)
        if existing is not None:
            if existing[0] != scenario:
                raise RuntimeError("provider key was reused with different input")
            return existing[1]
        self.invocation_count += 1
        if scenario == "confirmed_success":
            result = ProviderResult("succeeded", f"fake-{provider_key}")
        elif scenario == "confirmed_failure":
            result = ProviderResult("failed", error_code="provider_rejected")
        elif scenario == "unknown_then_success":
            result = ProviderResult("unknown")
        elif scenario == "no_idempotency":
            raise RuntimeError("provider lacks idempotency and reconciliation")
        else:
            raise ValueError(f"unsupported fake provider scenario: {scenario}")
        self._invocations[provider_key] = (scenario, result)
        return result

    def reconcile(self, provider_key: str) -> ProviderResult:
        existing = self._invocations.get(provider_key)
        if existing is not None and existing[1].outcome != "unknown":
            raise RuntimeError("provider key has no unknown invocation")
        if ":unknown_then_success:" not in provider_key:
            raise RuntimeError("provider key has no unknown invocation")
        result = ProviderResult("succeeded", f"fake-reconciled-{provider_key}")
        self._invocations[provider_key] = ("unknown_then_success", result)
        return result


class NonRepeatableFakeProvider:
    """A provider used to prove unsafe blind retries are rejected."""

    supports_idempotency = False
    supports_reconciliation = False

    def invoke(self, provider_key: str, scenario: Scenario) -> ProviderResult:
        raise RuntimeError("provider lacks idempotency and reconciliation")

    def reconcile(self, provider_key: str) -> ProviderResult:
        raise RuntimeError("provider lacks reconciliation")


def require_safe_provider(provider: ExternalProvider) -> None:
    if not provider.supports_idempotency and not provider.supports_reconciliation:
        raise RuntimeError("provider lacks idempotency and reconciliation")


def fake_provider_key(
    logical_operation_id: UUID,
    scenario: Scenario,
) -> str:
    return f"cumulore.synthetic.v1:{scenario}:{logical_operation_id}"
