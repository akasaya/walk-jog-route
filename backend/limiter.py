from fastapi import Request
from slowapi import Limiter


def _get_user_id(request: Request) -> str:
    return request.headers.get("X-User-Id") or (
        request.client.host if request.client else "anonymous"
    )


limiter = Limiter(key_func=_get_user_id)
