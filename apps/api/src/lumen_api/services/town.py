"""Town object states. The web app applies the same rule; both are checked against shared fixtures."""

from typing import Any


def object_states(objects: list[dict[str, Any]], done: list[str]) -> dict[str, str]:
    """`done` is finished lesson ids, oldest first."""
    finished = set(done)
    states: dict[str, str] = {}
    open_objects: list[dict[str, Any]] = []
    for obj in objects:
        lesson = obj.get("lesson")
        if lesson is None:
            states[obj["id"]] = "soon"
        elif lesson in finished:
            states[obj["id"]] = "done"
        elif any(need not in finished for need in obj.get("needs", [])):
            states[obj["id"]] = "locked"
        else:
            states[obj["id"]] = "available"
            open_objects.append(obj)

    open_objects.sort(key=lambda o: o.get("number") or 999)
    if not open_objects:
        return states

    known_lessons = {o.get("lesson") for o in objects}
    known = [lesson for lesson in done if lesson in known_lessons]
    last = known[-1] if known else None
    primary = next(
        (o for o in open_objects if last is not None and last in o.get("needs", [])), open_objects[0]
    )
    states[primary["id"]] = "next"
    if known:
        secondary = next((o for o in open_objects if o["subject"] != primary["subject"]), None)
        if secondary is not None:
            states[secondary["id"]] = "next"
    return states
