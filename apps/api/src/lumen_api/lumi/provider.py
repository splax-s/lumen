"""What the tutor needs from a language model, whichever company provides it."""

from dataclasses import dataclass
from typing import Literal, Protocol, TypedDict


class Message(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True)
class Verdict:
    """A second opinion on a reply before a learner sees it."""

    on_topic: bool
    age_appropriate: bool
    consistent: bool
    reason: str = ""

    @property
    def passed(self) -> bool:
        return self.on_topic and self.age_appropriate and self.consistent

    @property
    def failure(self) -> str:
        if not self.on_topic:
            return "off_topic"
        if not self.age_appropriate:
            return "not_age_appropriate"
        if not self.consistent:
            return "contradicts_facts"
        return ""


class ProviderError(Exception):
    """The model could not be reached, refused, or answered in a way we cannot use."""

    def __init__(self, kind: str, message: str = "") -> None:
        super().__init__(message or kind)
        self.kind = kind


class TutorProvider(Protocol):
    name: str

    async def complete(self, system: str, context: str, messages: list[Message]) -> str:
        """A short tutor reply. `system` never changes; `context` describes this lesson moment."""
        ...

    async def judge(self, reply: str, facts: list[str], depth: str) -> Verdict:
        """Is this reply about science, right for the learner's level, and consistent with the facts?"""
        ...


JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "on_topic": {"type": "boolean"},
        "age_appropriate": {"type": "boolean"},
        "consistent": {"type": "boolean"},
        "reason": {"type": "string"},
    },
    "required": ["on_topic", "age_appropriate", "consistent", "reason"],
    "additionalProperties": False,
}

JUDGE_SYSTEM = """You review one reply written by Lumi, a science guide for children, before a learner sees it.

Answer three questions about the reply:
- on_topic: it is about science, maths or music as taught in the lesson, and nothing else.
- age_appropriate: the wording and content suit the stated level, it is kind, and it asks for no personal details.
- consistent: nothing in it contradicts the lesson facts. Extra true detail is fine. A claim the facts contradict is not.

Be strict. If you are unsure about any of the three, answer false for it. Give a short reason."""


def judge_request(reply: str, facts: list[str], depth: str) -> str:
    levels = {
        "play": "Play: ages 6 to 10, simple words, no numbers.",
        "explain": "Explain: ages 11 to 15, real terms and simple numbers.",
        "deep": "Deep: ages 16 and up, formulas and units are welcome.",
    }
    fact_lines = "\n".join(f"- {fact}" for fact in facts) or "- (no facts supplied)"
    return f"Level: {levels.get(depth, levels['explain'])}\n\nLesson facts:\n{fact_lines}\n\nReply to review:\n{reply}"
