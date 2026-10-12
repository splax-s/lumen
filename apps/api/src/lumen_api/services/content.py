"""The compiled lesson files and town catalog, read from packages/lessons/dist."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..config import get_settings


class Content:
    def __init__(self, dist: Path) -> None:
        self.dist = dist
        catalog_path = dist / "catalog.json"
        lessons_path = dist / "lessons.json"
        self.catalog: dict[str, Any] = (
            json.loads(catalog_path.read_text()) if catalog_path.exists() else {"objects": [], "threads": []}
        )
        lessons: list[dict[str, Any]] = json.loads(lessons_path.read_text()) if lessons_path.exists() else []
        self.lessons: dict[str, dict[str, Any]] = {lesson["id"]: lesson for lesson in lessons}

    @property
    def objects(self) -> list[dict[str, Any]]:
        objects: list[dict[str, Any]] = self.catalog["objects"]
        return objects

    def object_for(self, lesson_id: str) -> dict[str, Any] | None:
        return next((o for o in self.objects if o.get("lesson") == lesson_id), None)

    def lesson_ids(self) -> list[str]:
        """Every lesson in the launch curriculum, whether or not its file is written yet."""
        return [o["lesson"] for o in self.objects if o.get("lesson")]

    def facts(self, lesson_id: str) -> list[str]:
        lesson = self.lessons.get(lesson_id)
        return [fact["text"] for fact in lesson.get("facts", [])] if lesson else []


@lru_cache
def get_content() -> Content:
    return Content(get_settings().lessons_path)
