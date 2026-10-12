"""Lumi on any service that speaks the OpenAI chat-completions format.

This exists because the owner asked for a way to run the tutor on another model when no
Anthropic key is available. It is plain HTTP, so it works with hosted services and local
servers alike. Set LUMI_PROVIDER=openai_compatible, OPENAI_BASE_URL, OPENAI_API_KEY and
LUMI_MODEL.
"""

import json

import httpx

from .provider import JUDGE_SCHEMA, JUDGE_SYSTEM, Message, ProviderError, Verdict, judge_request


class OpenAICompatibleProvider:
    name = "openai_compatible"

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 20.0) -> None:
        self.model = model
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.timeout = timeout

    async def _chat(
        self, messages: list[dict[str, str]], json_schema: dict[str, object] | None = None
    ) -> str:
        body: dict[str, object] = {"model": self.model, "messages": messages, "max_tokens": 1200}
        if json_schema is not None:
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "verdict", "strict": True, "schema": json_schema},
            }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.url, headers=self.headers, json=body)
        except httpx.HTTPError as error:
            raise ProviderError("network", str(error)) from error
        if response.status_code == 401:
            raise ProviderError("auth")
        if response.status_code == 429:
            raise ProviderError("rate_limited")
        if response.status_code >= 400:
            raise ProviderError("server" if response.status_code >= 500 else "api", response.text[:200])
        try:
            choice = response.json()["choices"][0]
            text = choice["message"].get("content") or ""
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
            raise ProviderError("bad_response") from error
        if choice.get("finish_reason") == "content_filter" or choice["message"].get("refusal"):
            raise ProviderError("refused")
        if not str(text).strip():
            raise ProviderError("empty")
        return str(text).strip()

    async def complete(self, system: str, context: str, messages: list[Message]) -> str:
        chat = [{"role": "system", "content": f"{system}\n\n{context}"}]
        chat.extend({"role": m["role"], "content": m["content"]} for m in messages)
        return await self._chat(chat)

    async def judge(self, reply: str, facts: list[str], depth: str) -> Verdict:
        text = await self._chat(
            [
                {"role": "system", "content": JUDGE_SYSTEM + "\nAnswer with JSON only."},
                {"role": "user", "content": judge_request(reply, facts, depth)},
            ],
            json_schema=JUDGE_SCHEMA,
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
