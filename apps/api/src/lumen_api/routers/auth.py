"""Sign up, sign in, sign out."""

from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .. import clock
from ..deps import Cache, Config, Db, SignedIn
from ..models import LearnerProfile, ParentAccount
from ..ratelimit import rate_limit
from ..schemas import AccountOut, LoginIn, MeOut, ProfileOut, SignupIn
from ..security import hash_password, verify_password
from ..sessions import COOKIE, create_session, end_session

router = APIRouter(prefix="/auth", tags=["auth"])


def _account_out(account: ParentAccount) -> AccountOut:
    return AccountOut(
        id=account.id,
        email=account.email,
        country=account.country,
        role=account.role,
        plan=account.plan,
        staff_level=account.staff_level,
    )


def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def set_session_cookie(response: Response, token: str, ttl_seconds: int, secure: bool) -> None:
    response.set_cookie(
        COOKIE, token, max_age=ttl_seconds, httponly=True, samesite="lax", secure=secure, path="/"
    )


@router.post("/signup", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignupIn, request: Request, response: Response, db: Db, redis: Cache, settings: Config
) -> AccountOut:
    """Creates an adult account. Children never sign up; an adult adds them as profiles."""
    await rate_limit(redis, f"signup:{_client(request)}", settings.signup_limit, settings.signup_window)
    email = body.email.lower()
    account = ParentAccount(
        email=email,
        password_hash=hash_password(body.password),
        country=body.country,
        role=body.role,
        consents=[
            {"kind": kind, "version": "2026-10", "at": clock.now().isoformat()}
            for kind in ("terms", "privacy", "is_adult")
        ],
    )
    db.add(account)
    try:
        await db.flush()
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "email_taken") from error
    ttl = settings.session_ttl_hours * 3600
    token = await create_session(redis, "account", account.id, ttl)
    set_session_cookie(response, token, ttl, settings.cookie_secure)
    return _account_out(account)


@router.post("/login", response_model=AccountOut)
async def login(
    body: LoginIn, request: Request, response: Response, db: Db, redis: Cache, settings: Config
) -> AccountOut:
    email = body.email.lower()
    await rate_limit(redis, f"login:{email}", settings.login_limit, settings.login_window)
    await rate_limit(redis, f"login-ip:{_client(request)}", settings.login_limit * 5, settings.login_window)
    account = await db.scalar(select(ParentAccount).where(ParentAccount.email == email))
    # The same answer for an unknown email and a wrong password, so neither can be probed.
    if not verify_password(body.password, account.password_hash if account else None) or account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_credentials")
    hours = settings.staff_session_ttl_hours if account.staff_level else settings.session_ttl_hours
    ttl = hours * 3600
    token = await create_session(redis, "account", account.id, ttl)
    set_session_cookie(response, token, ttl, settings.cookie_secure)
    return _account_out(account)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response, redis: Cache, token: Annotated[str | None, Cookie(alias=COOKIE)] = None
) -> None:
    await end_session(redis, token)
    response.delete_cookie(COOKIE, path="/")


@router.get("/me", response_model=MeOut)
async def me(principal: SignedIn, db: Db) -> MeOut:
    if principal.account is not None:
        rows = await db.scalars(
            select(LearnerProfile)
            .where(LearnerProfile.parent_id == principal.account.id)
            .order_by(LearnerProfile.created_at)
        )
        profiles = [ProfileOut.model_validate(p) for p in rows]
        return MeOut(kind="account", account=_account_out(principal.account), profiles=profiles)
    assert principal.profile is not None
    return MeOut(kind="pupil", account=None, profiles=[ProfileOut.model_validate(principal.profile)])
