"""Command line tasks: `uv run lumen-api <command>`."""

import asyncio
import getpass
from typing import Annotated, Any

import typer
from sqlalchemy import select

from .db import get_sessionmaker
from .models import ParentAccount
from .security import hash_password
from .services.content import get_content
from .services.lesson_sync import sync_lessons

app = typer.Typer(help="Lumen API maintenance commands.", no_args_is_help=True)


def _run(coroutine: Any) -> Any:
    return asyncio.run(coroutine)


@app.command("sync-lessons")
def sync_lessons_command() -> None:
    """Copy the compiled lesson files into the database."""

    async def go() -> dict[str, Any]:
        async with get_sessionmaker()() as db:
            result = await sync_lessons(db, get_content())
            await db.commit()
            return result

    result = _run(go())
    typer.echo(
        f"Lessons: {result['total']} total, {len(result['added'])} added, {len(result['updated'])} updated, {len(result['removed'])} removed."
    )


@app.command("create-staff")
def create_staff(
    email: Annotated[str, typer.Argument(help="The staff member's email address.")],
    level: Annotated[str, typer.Option(help="support or admin")] = "support",
    password: Annotated[str | None, typer.Option(help="Leave out to be asked for it.")] = None,
) -> None:
    """Create a staff account for the ops console, or change an existing account's staff level.

    Staff accounts cannot be created through sign-up. This command is the only way.
    """
    if level not in ("support", "admin"):
        raise typer.BadParameter("level must be support or admin")

    async def go(secret: str | None) -> str:
        async with get_sessionmaker()() as db:
            account = await db.scalar(select(ParentAccount).where(ParentAccount.email == email.lower()))
            if account is None:
                if not secret or len(secret) < 12:
                    raise typer.BadParameter(
                        "A new staff account needs a password of at least 12 characters."
                    )
                account = ParentAccount(
                    email=email.lower(), password_hash=hash_password(secret), country="NG", consents=[]
                )
                db.add(account)
                outcome = "created"
            else:
                if secret:
                    account.password_hash = hash_password(secret)
                outcome = "updated"
            account.staff_level = level
            await db.commit()
            return outcome

    secret = password
    if secret is None:
        secret = getpass.getpass("Password (leave empty to keep an existing one): ") or None
    typer.echo(f"Staff account {email.lower()} {_run(go(secret))} with level {level}.")


@app.command("purge-tutor-messages")
def purge_tutor_messages() -> None:
    """Delete tutor messages older than the retention period. Meant to run once a day."""
    from .services.retention import purge_old_tutor_messages

    async def go() -> int:
        async with get_sessionmaker()() as db:
            removed = await purge_old_tutor_messages(db)
            await db.commit()
            return removed

    typer.echo(f"Removed {_run(go())} tutor message(s).")
