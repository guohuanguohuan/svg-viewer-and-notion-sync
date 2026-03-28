import base64
import html
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from openai import OpenAI
from pydantic import BaseModel, Field

HF_AUTHORIZE_URL = "https://huggingface.co/oauth/authorize"
HF_TOKEN_URL = "https://huggingface.co/oauth/token"
HF_WHOAMI_URL = "https://huggingface.co/api/whoami-v2"
SESSION_COOKIE_NAME = "hf_access_token"
STATE_COOKIE_NAME = "hf_oauth_state"


def load_allowed_usernames() -> set[str]:
    raw_value = os.environ.get("ALLOWED_HF_USERNAMES", "")
    return {
        username.strip().lower()
        for username in raw_value.split(",")
        if username.strip()
    }


ALLOWED_HF_USERNAMES = load_allowed_usernames()

app = FastAPI(title="AutoFlow Agent API")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    system_message: str = Field(
        default="你是一个专业的写作助手，帮助用户进行文章创作。"
    )
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=4.0)
    top_p: float = Field(default=0.95, ge=0.0, le=1.0)


def get_allowlist_message() -> str:
    return (
        "Only allowlisted users can use this app. "
        "Browser login and plugin access tokens are both supported."
    )


def get_plugin_setup_message() -> str:
    return (
        "Sign in from the browser, or configure an access token in the Obsidian plugin."
    )


def is_username_allowed(username: str | None) -> bool:
    if not username:
        return False
    return username.lower() in ALLOWED_HF_USERNAMES


def get_request_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "").strip()
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token:
            return token

    custom_token = request.headers.get("x-hf-token", "").strip()
    if custom_token:
        return custom_token

    cookie_token = request.cookies.get(SESSION_COOKIE_NAME, "").strip()
    return cookie_token or None


@lru_cache(maxsize=64)
def get_username_from_hf_token(token: str) -> str | None:
    request = urllib.request.Request(
        HF_WHOAMI_URL,
        headers={"Authorization": f"Bearer {token}"},
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
    ):
        return None

    username = payload.get("name")
    if isinstance(username, str) and username.strip():
        return username.strip()

    return None


def get_authorized_username(request: Request) -> str | None:
    token = get_request_token(request)
    if not token:
        return None

    username = get_username_from_hf_token(token)
    if not is_username_allowed(username):
        return None

    return username.lower()


def require_authorized_username(request: Request) -> str:
    if not ALLOWED_HF_USERNAMES:
        raise HTTPException(
            status_code=503,
            detail=(
                "This Space is not ready yet. Configure `ALLOWED_HF_USERNAMES` "
                "in Space settings before using the app."
            ),
        )

    authorized_username = get_authorized_username(request)
    if authorized_username:
        return authorized_username

    raise HTTPException(
        status_code=401,
        detail=(
            "Access denied. "
            f"{get_plugin_setup_message()} {get_allowlist_message()}"
        ),
    )


def get_access_status(request: Request) -> dict[str, str | bool | None]:
    if not ALLOWED_HF_USERNAMES:
        return {
            "ok": False,
            "username": None,
            "message": (
                "This service is locked until `ALLOWED_HF_USERNAMES` is configured "
                "in the service settings."
            ),
        }

    token = get_request_token(request)
    authorized_username = get_authorized_username(request)
    if authorized_username:
        return {
            "ok": True,
            "username": authorized_username,
            "message": f"Authenticated as @{authorized_username}.",
        }

    if not token:
        return {
            "ok": False,
            "username": None,
            "message": (
                f"{get_plugin_setup_message()} {get_allowlist_message()}"
            ),
        }

    return {
        "ok": False,
        "username": None,
        "message": "The provided Hugging Face token could not be verified.",
    }


def complete_once(
    message: str,
    system_message: str,
    max_tokens: int,
    temperature: float,
    top_p: float,
) -> str:
    api_key = os.environ.get("ZHIPU_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("`ZHIPU_API_KEY` is not configured.")

    client = OpenAI(
        api_key=api_key,
        base_url="https://open.bigmodel.cn/api/paas/v4/",
    )
    response = client.chat.completions.create(
        model="glm-4.7-flash",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": message},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
    )

    return response.choices[0].message.content or ""


def get_space_base_url() -> str | None:
    space_host = os.environ.get("SPACE_HOST", "").strip()
    if not space_host:
        return None
    return f"https://{space_host}"


def build_scope_string() -> str:
    requested_scopes = os.environ.get("OAUTH_SCOPES", "").strip()
    scope_values = {"openid", "profile"}
    if requested_scopes:
        scope_values.update(scope for scope in requested_scopes.split() if scope)
    return " ".join(sorted(scope_values))


def get_oauth_redirect_uri() -> str | None:
    base_url = get_space_base_url()
    if not base_url:
        return None
    return f"{base_url}/login/callback"


def build_oauth_login_url(state: str) -> str:
    client_id = os.environ.get("OAUTH_CLIENT_ID", "").strip()
    redirect_uri = get_oauth_redirect_uri()
    if not client_id or not redirect_uri:
        raise RuntimeError("OAuth is not configured for this Space.")

    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": build_scope_string(),
            "state": state,
        }
    )
    return f"{HF_AUTHORIZE_URL}?{query}"


def exchange_code_for_token(code: str) -> str:
    client_id = os.environ.get("OAUTH_CLIENT_ID", "").strip()
    client_secret = os.environ.get("OAUTH_CLIENT_SECRET", "").strip()
    redirect_uri = get_oauth_redirect_uri()
    if not client_id or not client_secret or not redirect_uri:
        raise RuntimeError("OAuth environment variables are missing.")

    payload = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")
    credentials = base64.b64encode(
        f"{client_id}:{client_secret}".encode("utf-8")
    ).decode("ascii")
    request = urllib.request.Request(
        HF_TOKEN_URL,
        data=payload,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            token_payload = json.loads(response.read().decode("utf-8"))
    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
    ) as error:
        raise RuntimeError("Failed to exchange the OAuth code for a token.") from error

    access_token = token_payload.get("access_token")
    if isinstance(access_token, str) and access_token.strip():
        return access_token.strip()

    raise RuntimeError("OAuth response did not include an access token.")


def render_home_page(request: Request) -> str:
    status = get_access_status(request)
    escaped_message = html.escape(str(status["message"]))
    username = status["username"]
    escaped_username = html.escape(username) if isinstance(username, str) else ""
    login_section = ""

    if username:
        login_section = (
            f"<p>当前登录用户：<strong>@{escaped_username}</strong></p>"
            "<p><a href=\"/logout\">退出登录</a></p>"
        )
    elif os.environ.get("OAUTH_CLIENT_ID", "").strip():
        login_section = (
            "<p><a href=\"/login\">使用 Hugging Face 登录</a></p>"
        )

    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AutoFlow Agent API</title>
    <style>
      body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        padding: 32px 20px;
        background: #f5f1e8;
        color: #1f2328;
      }}
      main {{
        max-width: 720px;
        margin: 0 auto;
        background: #fffdf8;
        border: 1px solid #e7decf;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(92, 67, 38, 0.08);
      }}
      code {{
        background: #f1e9db;
        padding: 2px 6px;
        border-radius: 6px;
      }}
      a {{
        color: #9d4f14;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>AutoFlow Agent API</h1>
      <p>这个 Space 现在只提供给 Obsidian 插件使用的后端接口，不再依赖 Gradio 聊天页面。</p>
      <p>当前状态：{escaped_message}</p>
      {login_section}
      <h2>可用接口</h2>
      <p><code>GET /health</code></p>
      <p><code>GET /api/access-status</code></p>
      <p><code>POST /api/chat</code></p>
      <p>插件调用时请在请求头中附带 Hugging Face token：<code>Authorization: Bearer hf_xxx</code></p>
    </main>
  </body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    return HTMLResponse(render_home_page(request))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/access-status")
async def api_access_status(request: Request) -> JSONResponse:
    status = get_access_status(request)
    response = JSONResponse(status)
    if request.cookies.get(SESSION_COOKIE_NAME) and not status["ok"]:
        response.delete_cookie(SESSION_COOKIE_NAME)
    return response


@app.post("/api/chat")
async def api_chat(payload: ChatRequest, request: Request) -> dict[str, str]:
    username = require_authorized_username(request)

    try:
        reply = complete_once(
            message=payload.message,
            system_message=payload.system_message,
            max_tokens=payload.max_tokens,
            temperature=payload.temperature,
            top_p=payload.top_p,
        )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"AutoFlow backend error: {error}",
        ) from error

    return {
        "reply": reply,
        "username": username,
    }


@app.get("/login")
async def login() -> RedirectResponse:
    state = secrets.token_urlsafe(24)

    try:
        login_url = build_oauth_login_url(state)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    response = RedirectResponse(login_url, status_code=302)
    response.set_cookie(
        STATE_COOKIE_NAME,
        state,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=600,
    )
    return response


@app.get("/login/callback")
async def login_callback(code: str, state: str, request: Request) -> RedirectResponse:
    saved_state = request.cookies.get(STATE_COOKIE_NAME, "")
    if not saved_state or not secrets.compare_digest(saved_state, state):
        raise HTTPException(status_code=400, detail="OAuth state validation failed.")

    try:
        access_token = exchange_code_for_token(code)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    response = RedirectResponse("/", status_code=302)
    response.delete_cookie(STATE_COOKIE_NAME)
    response.set_cookie(
        SESSION_COOKIE_NAME,
        access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=28800,
    )
    return response


@app.get("/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse("/", status_code=302)
    response.delete_cookie(SESSION_COOKIE_NAME)
    response.delete_cookie(STATE_COOKIE_NAME)
    return response
