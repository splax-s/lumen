"""Rule-based checks on what learners type and on what Lumi is about to say.

These run on every message and need no model. A reply that fails any of them is never shown;
a scripted line is shown instead.
"""

import re
from dataclasses import dataclass

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?<!\d)(?:\+?\d[\s\-().]?){8,14}\d(?!\d)")
URL = re.compile(r"(?:https?://|www\.)\S+|\b[\w-]+\.(?:com|net|org|io|ng|co\.uk|app|gg|me)\b(?:/\S*)?", re.I)
WRONG = re.compile(r"\bwrong\b", re.I)

# Things Lumi must never ask a learner.
ASKS_FOR_PERSONAL_DATA = re.compile(
    r"""(?ix)
    \b(?:what(?:'s|\s+is)|tell\s+me|give\s+me|share|send(?:\s+me)?|can\s+i\s+have|may\s+i\s+have|do\s+you\s+have)\b
    [^.?!]{0,40}?
    \byour\s+(?:real\s+|full\s+|last\s+|first\s+|home\s+|parents?'?s?\s+|mum'?s\s+|mom'?s\s+|dad'?s\s+)?
    (?:name|surname|age|birthday|address|school|class|teacher|phone|number|email|password|photo|picture|selfie|location|city|town|street)\b
    | \bhow\s+old\s+are\s+you\b
    | \bwhere\s+do\s+you\s+(?:live|go\s+to\s+school)\b
    | \bwhich\s+school\b
    | \bwhat\s+school\b
    | \bsend\s+(?:me\s+)?a\s+(?:photo|picture|selfie)\b
    """
)

# A learner telling Lumi where they live or who they are. The details are removed before storing.
SHARES_PERSONAL_DATA = re.compile(
    r"(?i)\b(?:my\s+(?:real\s+|full\s+)?name\s+is|i\s+live\s+(?:at|in|on)|my\s+address\s+is|my\s+school\s+is|"
    r"i\s+go\s+to\s+[\w' ]+\s+school|my\s+(?:phone\s+)?number\s+is|my\s+email\s+is|my\s+password\s+is)\b"
)

# Signs that a child may need a trusted adult rather than a science guide.
NEEDS_ADULT = re.compile(
    r"(?i)\b(?:kill\s+myself|hurt\s+myself|want\s+to\s+die|suicide|self[\s-]?harm|someone\s+(?:hits|hurts|touches)\s+me|"
    r"(?:he|she|they)\s+(?:hits?|hurts?|touch(?:es)?)\s+me|i(?:'m|\s+am)\s+(?:scared|afraid)\s+of\s+(?:my|him|her)|"
    r"being\s+bullied|bullying\s+me|run\s+away\s+from\s+home)\b"
)

# Plainly outside a science lesson. The model judge handles the subtler cases.
OFF_LIMITS = re.compile(
    r"(?i)\b(?:sex|sexy|porn|naked|nude|boyfriend|girlfriend|dating|kiss(?:ing)?|gun|guns|shoot(?:ing)?|bomb|weapon|"
    r"murder|drugs?|cocaine|weed|vape|vaping|alcohol|beer|gambl\w*|bet(?:ting)?|casino|"
    r"election|president|politic\w*|religio\w*|password|credit\s+card|ignore\s+(?:all\s+|your\s+|previous\s+)+instructions|"
    r"system\s+prompt|pretend\s+(?:to\s+be|you\s+are)|jailbreak)\b"
)

MAX_QUESTION_CHARS = 300
MAX_WORDS = {"play": 60, "explain": 110, "deep": 180}
MAX_SENTENCE_WORDS = {"play": 22, "explain": 34, "deep": 48}


@dataclass(frozen=True)
class Screened:
    """A learner's message after screening. `text` is safe to store; details are removed."""

    result: str  # "ok" or "blocked:<reason>"
    text: str

    @property
    def ok(self) -> bool:
        return self.result == "ok"


def redact(text: str) -> str:
    text = EMAIL.sub("[email removed]", text)
    text = URL.sub("[link removed]", text)
    return PHONE.sub("[number removed]", text)


def screen_question(text: str) -> Screened:
    """Decides whether a learner's free-text question may go to the model."""
    cleaned = " ".join(text.split())[:MAX_QUESTION_CHARS]
    if not cleaned:
        return Screened("blocked:empty", "")
    if NEEDS_ADULT.search(cleaned):
        # Not stored in full: this may be a disclosure, and the log is read by staff.
        return Screened("blocked:needs_adult", "[message not stored]")
    if (
        EMAIL.search(cleaned)
        or PHONE.search(cleaned)
        or URL.search(cleaned)
        or SHARES_PERSONAL_DATA.search(cleaned)
    ):
        match = SHARES_PERSONAL_DATA.search(cleaned)
        kept = cleaned[: match.start()] + "[personal details removed]" if match else cleaned
        return Screened("blocked:personal_data", redact(kept))
    if OFF_LIMITS.search(cleaned):
        return Screened("blocked:off_topic", cleaned)
    return Screened("ok", cleaned)


def check_reply(text: str, depth: str, forbidden: list[str] | None = None) -> str:
    """Rule checks on a model reply. Returns "ok" or "blocked:<reason>"."""
    words = text.split()
    if not words:
        return "blocked:empty"
    if len(words) > MAX_WORDS.get(depth, MAX_WORDS["explain"]):
        return "blocked:too_long"
    if WRONG.search(text):
        return "blocked:says_wrong"
    if URL.search(text) or EMAIL.search(text):
        return "blocked:link"
    if ASKS_FOR_PERSONAL_DATA.search(text):
        return "blocked:personal_data"
    if OFF_LIMITS.search(text) or NEEDS_ADULT.search(text):
        return "blocked:off_topic"
    longest = max(len(sentence.split()) for sentence in re.split(r"[.!?]+", text) if sentence.strip())
    if longest > MAX_SENTENCE_WORDS.get(depth, MAX_SENTENCE_WORDS["explain"]):
        return "blocked:hard_to_read"
    if depth == "play" and re.search(r"\d", text):
        return "blocked:numbers_at_play"
    lowered = text.lower()
    for phrase in forbidden or []:
        if phrase and phrase.lower() in lowered:
            return "blocked:answer_before_hints"
    return "ok"
