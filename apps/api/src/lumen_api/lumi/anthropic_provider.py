"""Lumi on Claude, through the official Anthropic SDK."""

import json

import anthropic

from .provider import JUDGE_SCHEMA, JUDGE_SYSTEM, Message, ProviderError, Verdict, judge_request

# Thinking tokens count toward max_tokens on current models, so this is deliberately roomy.
# The reply itself is kept short by the instructions and then checked for length.
MAX_TOKENS = 16000


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, effort: str = "low", timeout: float = 20.0) -> None:
        self.model = model
        self.effort = effort
        # The SDK retries connection errors, 408, 409, 429 and 5xx itself, with backoff.
        self.client = anthropic.AsyncAnthropic(api_key=api_key, timeout=timeout, max_retries=2)

    def _output_config(self, schema: dict[str, object] | None = None) -> dict[str, object]:
        config: dict[str, object] = {}
        if self.effort:
            config["effort"] = self.effort
        if schema is not None:
            config["format"] = {"type": "json_schema", "schema": schema}
        return config

    async def _create(
        self,
        system: list[dict[str, object]],
        messages: list[Message],
        schema: dict[str, object] | None = None,
    ) -> str:
        output_config = self._output_config(schema)
        try:
            response = await self.client.messages.create(  # type: ignore[call-overload]
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                **({"output_config": output_config} if output_config else {}),
            )
        except anthropic.BadRequestError as error:
            raise ProviderError("bad_request", error.message) from error
        except anthropic.AuthenticationError as error:
            raise ProviderError("auth", "The Anthropic API key was rejected") from error
        except anthropic.PermissionDeniedError as error:
            raise ProviderError("permission", error.message) from error
        except anthropic.NotFoundError as error:
            raise ProviderError("model_not_found", f"Unknown model {self.model!r}") from error
        except anthropic.RateLimitError as error:
            raise ProviderError("rate_limited", error.message) from error
        except anthropic.APIStatusError as error:
            raise ProviderError("server" if error.status_code >= 500 else "api", error.message) from error
        except anthropic.APIConnectionError as error:  # includes timeouts
            raise ProviderError("network", str(error)) from error

        # A refusal arrives as a normal response, so check before reading the content.
        if response.stop_reason == "refusal":
            raise ProviderError("refused")
        if response.stop_reason == "max_tokens":
            raise ProviderError("truncated")
        text = next((block.text for block in response.content if block.type == "text"), "")
        if not text.strip():
            raise ProviderError("empty")
        return str(text).strip()

    async def complete(self, system: str, context: str, messages: list[Message]) -> str:
        # The persona and rules never change, so they are cached. The lesson context comes after
        # the cache breakpoint because it differs from one moment to the next.
        blocks: list[dict[str, object]] = [
            {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": context},
        ]
        return await self._create(blocks, messages)

    async def judge(self, reply: str, facts: list[str], depth: str) -> Verdict:
        blocks: list[dict[str, object]] = [
            {"type": "text", "text": JUDGE_SYSTEM, "cache_control": {"type": "ephemeral"}}
        ]
        text = await self._create(
            blocks, [{"role": "user", "content": judge_request(reply, facts, depth)}], schema=JUDGE_SCHEMA
        )
        try:
            data = json.loads(text)
            return Verdict(
                on_topic=bool(data["on_topic"]),
                age_appropriate=bool(data["age_appropriate"]),
                consistent=bool(data["consistent"]),
                reason=str(data.get("reason", ""))[:300],
            )
        except (ValueError, KeyError, TypeError) as error:
            raise ProviderError("bad_verdict") from error
