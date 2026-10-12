from typing import Any

from httpx import AsyncClient

from .conftest import PASSWORD, add_profile, make_client, sign_up


async def test_health_reports_each_service(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.json() == {"api": "ok", "database": "ok", "redis": "ok"}


async def test_signup_signs_you_in_and_never_returns_the_password(client: AsyncClient) -> None:
    account = await sign_up(client, "Parent@Example.com")
    assert account["email"] == "parent@example.com"
    assert account["plan"] == "free"
    assert account["staff_level"] is None
    assert "password" not in str(account).lower()
    me = await client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["account"]["email"] == "parent@example.com"
    assert me.json()["profiles"] == []


async def test_session_cookie_is_http_only_and_same_site(client: AsyncClient) -> None:
    body = {
        "email": "a@example.com",
        "password": PASSWORD,
        "country": "NG",
        "consent": {"terms": True, "privacy": True, "is_adult": True},
    }
    response = await client.post("/auth/signup", json=body)
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie


async def test_signup_records_consent(client: AsyncClient, db: Any) -> None:
    from sqlalchemy import select

    from lumen_api.models import ParentAccount

    await sign_up(client, "c@example.com")
    account = await db.scalar(select(ParentAccount))
    assert {c["kind"] for c in account.consents} == {"terms", "privacy", "is_adult"}
    assert account.password_hash.startswith("$argon2id$")


async def test_signup_rejects_a_duplicate_email_whatever_its_case(
    client: AsyncClient, other: AsyncClient
) -> None:
    await sign_up(client, "dup@example.com")
    body = {
        "email": "DUP@example.com",
        "password": PASSWORD,
        "country": "NG",
        "consent": {"terms": True, "privacy": True, "is_adult": True},
    }
    response = await other.post("/auth/signup", json=body)
    assert response.status_code == 409
    assert response.json()["detail"] == "email_taken"


async def test_signup_needs_consent_a_long_password_and_a_real_email(client: AsyncClient) -> None:
    good = {
        "email": "ok@example.com",
        "password": PASSWORD,
        "country": "NG",
        "consent": {"terms": True, "privacy": True, "is_adult": True},
    }
    for change in (
        {"password": "short"},
        {"email": "not-an-email"},
        {"country": "Nigeria"},
        {"consent": {"terms": True, "privacy": False, "is_adult": True}},
        {"consent": {"terms": True, "privacy": True, "is_adult": False}},
        {"staff_level": "admin"},
        {"plan": "family"},
    ):
        response = await client.post("/auth/signup", json={**good, **change})
        assert response.status_code == 422, change


async def test_login_gives_the_same_answer_for_a_wrong_password_and_an_unknown_email(
    client: AsyncClient, anonymous: AsyncClient
) -> None:
    await sign_up(client, "known@example.com")
    wrong = await anonymous.post(
        "/auth/login", json={"email": "known@example.com", "password": "not the password"}
    )
    unknown = await anonymous.post("/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "invalid_credentials"}


async def test_login_then_logout(client: AsyncClient, anonymous: AsyncClient) -> None:
    await sign_up(client, "in@example.com")
    assert (await anonymous.get("/auth/me")).status_code == 401
    response = await anonymous.post("/auth/login", json={"email": "IN@example.com", "password": PASSWORD})
    assert response.status_code == 200
    assert (await anonymous.get("/auth/me")).status_code == 200
    assert (await anonymous.post("/auth/logout")).status_code == 204
    assert (await anonymous.get("/auth/me")).status_code == 401


async def test_login_is_rate_limited_per_email(client: AsyncClient, anonymous: AsyncClient) -> None:
    await sign_up(client, "limit@example.com")
    for _ in range(10):
        response = await anonymous.post(
            "/auth/login", json={"email": "limit@example.com", "password": "nope nope nope"}
        )
        assert response.status_code == 401
    blocked = await anonymous.post("/auth/login", json={"email": "limit@example.com", "password": PASSWORD})
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


async def test_requests_that_change_things_need_the_client_header(app: Any) -> None:
    from httpx import ASGITransport

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as bare:
        response = await bare.post("/auth/logout")
        assert response.status_code == 403
        assert response.json() == {"detail": "missing_client_header"}
        assert (await bare.get("/health")).status_code == 200


async def test_a_forged_or_stale_cookie_is_just_signed_out(app: Any) -> None:
    async with make_client(app) as c:
        c.cookies.set("lumen_session", "not-a-real-token")
        assert (await c.get("/auth/me")).status_code == 401
        c.cookies.set("lumen_session", "x" * 5000)
        assert (await c.get("/auth/me")).status_code == 401


async def test_profiles_belong_to_the_account(client: AsyncClient) -> None:
    await sign_up(client)
    ada = await add_profile(client, "Ada", "under_13")
    await add_profile(client, "Tobi", "13_15")
    assert ada["chat_unlocked"] is False
    listed = (await client.get("/profiles")).json()
    assert [p["nickname"] for p in listed] == ["Ada", "Tobi"]
    assert listed[1]["chat_unlocked"] is True
    assert set(ada) == {"id", "nickname", "avatar", "birth_year_band", "default_depth", "chat_unlocked"}


async def test_child_profiles_cannot_hold_personal_details(client: AsyncClient) -> None:
    await sign_up(client)
    good = {"nickname": "Ada", "birth_year_band": "under_13"}
    for extra in (
        {"email": "ada@example.com"},
        {"school": "Lagos Primary"},
        {"photo": "x"},
        {"location": "Lagos"},
        {"birth_date": "2017-01-01"},
        {"surname": "L"},
    ):
        response = await client.post("/profiles", json={**good, **extra})
        assert response.status_code == 422, extra
    for nickname in ("ada@example.com", "", "   ", "x" * 21, "Ada <script>", "08031234567 call me"):
        response = await client.post("/profiles", json={**good, "nickname": nickname})
        assert response.status_code == 422, nickname
    for nickname in ("Ada", "Chidi O", "Zoë", "Ngozi-2", "D'Arcy"):
        response = await client.post("/profiles", json={**good, "nickname": nickname})
        assert response.status_code == 201, nickname


async def test_an_account_has_a_profile_limit(client: AsyncClient) -> None:
    await sign_up(client)
    for n in range(5):
        await add_profile(client, f"Child {n}")
    response = await client.post("/profiles", json={"nickname": "One more", "birth_year_band": "adult"})
    assert response.status_code == 409
    assert response.json()["detail"] == "too_many_profiles"


async def test_one_account_cannot_touch_anothers_profile(client: AsyncClient, other: AsyncClient) -> None:
    await sign_up(client)
    await sign_up(other)
    ada = await add_profile(client)
    url = f"/profiles/{ada['id']}"
    assert (await other.patch(url, json={"nickname": "Mine"})).status_code == 404
    assert (await other.get(f"{url}/export")).status_code == 404
    assert (await other.delete(url)).status_code == 404
    assert (await client.get("/profiles")).json()[0]["nickname"] == "Ada"


async def test_profiles_need_a_signed_in_adult(anonymous: AsyncClient) -> None:
    assert (await anonymous.get("/profiles")).status_code == 401
    assert (
        await anonymous.post("/profiles", json={"nickname": "A", "birth_year_band": "adult"})
    ).status_code == 401


async def test_a_parent_can_unlock_chat_and_change_depth(client: AsyncClient) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    response = await client.patch(
        f"/profiles/{ada['id']}", json={"chat_unlocked": True, "default_depth": "explain"}
    )
    assert response.status_code == 200
    assert response.json()["chat_unlocked"] is True
    assert response.json()["default_depth"] == "explain"
    assert response.json()["nickname"] == "Ada"
    bad = await client.patch(f"/profiles/{ada['id']}", json={"birth_year_band": "adult"})
    assert bad.status_code == 422
