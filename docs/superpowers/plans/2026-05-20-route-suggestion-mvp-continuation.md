# Route Suggestion MVP — 続き実装プラン（タスク5〜8）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** バックエンドAPIの残りエンドポイント（ルート提案・実行・履歴）を完成させ、フロントエンド基盤を構築する

**Architecture:** 既存の4サービス（Weather/AI/Routing/History）をRouteServiceがオーケストレーション。非同期FastAPIエンドポイント経由で公開する。フロントエンドはVite+React+TypeScript。

**Tech Stack:** FastAPI / slowapi / pytest / Vite / React 19 / TypeScript / React Leaflet / pnpm

---

## 作業前の状態確認

完了済み（コミット済み）:
- tasks 1〜4: FastAPI基盤, WeatherService, AIService, RoutingService, HistoryService

次のタスク（本プランの対象）:
- **Task 5**: RouteService + POST /routes/suggest
- **Task 6**: POST /routes/{id}/start, POST /routes/{id}/track
- **Task 7**: GET /routes/history
- **Task 8**: フロントエンド基盤（Vite + React）

---

## ファイル構成

```
新規作成:
  backend/limiter.py                    # slowapi Limiter インスタンス（共有）
  backend/services/route.py             # RouteService（オーケストレーター）
  backend/routers/routes.py             # POST /routes/suggest
  backend/routers/route_execution.py    # POST /routes/{id}/start, /track
  backend/routers/history.py            # GET /routes/history
  tests/api/test_routes_suggest.py      # /routes/suggest の統合テスト
  tests/api/test_route_execution.py     # /routes/*/start, /track のテスト
  tests/api/test_history.py             # /routes/history のテスト
  frontend/                             # Vite+React+TypeScript プロジェクト
    src/api/client.ts
    src/api/routes.ts
    src/hooks/useGeolocation.ts
    src/utils/userId.ts

修正:
  backend/models/route.py               # StartRouteRequest, StartRouteResponse, TrackResponse 追加
  backend/requirements.txt              # slowapi 追加
  backend/main.py                       # 新ルーター・slowapi を登録
```

---

## Task 5.1: RouteService を実装する

**Files:**
- Create: `backend/services/route.py`
- Create: `tests/services/test_route_service.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# tests/services/test_route_service.py
"""RouteService の単体テスト (task 5.1)"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from backend.models.route import (
    RouteHistoryItem,
    RouteRequest,
    RouteSuggestionResponse,
    RouteWaypoints,
    WaypointItem,
    WeatherData,
)
from backend.services.route import RouteService

# ダミーデータ
TEST_REQUEST = RouteRequest(lat=35.0, lon=139.0, distance_km=5.0, mode="walk")
TEST_USER_ID = "user-abc"

MOCK_WEATHER = WeatherData(temp_c=20.0, condition="晴れ")
MOCK_HISTORY_DICTS = [
    {
        "route_id": "r1",
        "started_at": "2026-05-19T09:00:00",
        "mode": "walk",
        "distance_km": 4.0,
        "has_track": False,
        "polyline": "enc1",
    }
]
MOCK_WAYPOINTS = RouteWaypoints(
    waypoints=[WaypointItem(lat=35.1, lon=139.1)],
    reasoning="テスト理由",
)


@pytest.fixture
def services():
    weather_svc = MagicMock()
    weather_svc.get_current_weather = AsyncMock(return_value=MOCK_WEATHER)

    history_svc = MagicMock()
    history_svc.get_recent = MagicMock(return_value=MOCK_HISTORY_DICTS)

    ai_svc = MagicMock()
    ai_svc.generate_waypoints = MagicMock(return_value=MOCK_WAYPOINTS)

    routing_svc = MagicMock()
    routing_svc.generate_route = AsyncMock(return_value=("encoded_poly", 5000, 60))

    return weather_svc, history_svc, ai_svc, routing_svc


@pytest.fixture
def route_service(services):
    weather_svc, history_svc, ai_svc, routing_svc = services
    return RouteService(
        weather_service=weather_svc,
        history_service=history_svc,
        ai_service=ai_svc,
        routing_service=routing_svc,
    )


@pytest.mark.asyncio
async def test_suggest_returns_route_suggestion_response(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert isinstance(result, RouteSuggestionResponse)


@pytest.mark.asyncio
async def test_suggest_polyline_matches_routing_service(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.polyline == "encoded_poly"


@pytest.mark.asyncio
async def test_suggest_distance_m_matches_routing_service(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.distance_m == 5000


@pytest.mark.asyncio
async def test_suggest_estimated_minutes_matches_routing_service(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.estimated_minutes == 60


@pytest.mark.asyncio
async def test_suggest_weather_included_in_response(route_service):
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.weather == MOCK_WEATHER


@pytest.mark.asyncio
async def test_suggest_route_id_is_uuid_string(route_service):
    import uuid
    result = await route_service.suggest(TEST_REQUEST, TEST_USER_ID)
    uuid.UUID(result.route_id)  # raises ValueError if not valid UUID


@pytest.mark.asyncio
async def test_suggest_weather_none_when_weather_service_returns_none(services):
    weather_svc, history_svc, ai_svc, routing_svc = services
    weather_svc.get_current_weather = AsyncMock(return_value=None)
    svc = RouteService(
        weather_service=weather_svc,
        history_service=history_svc,
        ai_service=ai_svc,
        routing_service=routing_svc,
    )
    result = await svc.suggest(TEST_REQUEST, TEST_USER_ID)
    assert result.weather is None


@pytest.mark.asyncio
async def test_suggest_calls_routing_with_target_distance_m(services):
    weather_svc, history_svc, ai_svc, routing_svc = services
    svc = RouteService(
        weather_service=weather_svc,
        history_service=history_svc,
        ai_service=ai_svc,
        routing_service=routing_svc,
    )
    await svc.suggest(TEST_REQUEST, TEST_USER_ID)
    routing_svc.generate_route.assert_called_once()
    call_args = routing_svc.generate_route.call_args
    assert call_args.args[4] == 5000  # target_distance_m = 5.0km * 1000
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
cd /home/onom/walk-jog-route
pip install pytest-asyncio  # まだない場合
pytest tests/services/test_route_service.py -v
```

Expected: `ModuleNotFoundError: No module named 'backend.services.route'`

- [ ] **Step 3: RouteService を実装する**

```python
# backend/services/route.py
import asyncio
import uuid

from backend.models.route import (
    RouteHistoryItem,
    RouteRequest,
    RouteSuggestionResponse,
)
from backend.services.ai import AIService
from backend.services.history import HistoryService
from backend.services.routing import RoutingService
from backend.services.weather import WeatherService


class RouteService:
    def __init__(
        self,
        weather_service: WeatherService,
        history_service: HistoryService,
        ai_service: AIService,
        routing_service: RoutingService,
    ):
        self._weather = weather_service
        self._history = history_service
        self._ai = ai_service
        self._routing = routing_service

    async def suggest(self, request: RouteRequest, user_id: str) -> RouteSuggestionResponse:
        weather = await self._weather.get_current_weather(request.lat, request.lon)

        history_dicts = await asyncio.to_thread(self._history.get_recent, user_id, 10)
        history = [RouteHistoryItem(**item) for item in history_dicts]

        waypoints_result = await asyncio.to_thread(
            self._ai.generate_waypoints,
            request.lat,
            request.lon,
            request.distance_km,
            request.mode,
            history,
            weather,
        )

        target_distance_m = int(request.distance_km * 1000)
        polyline, distance_m, estimated_minutes = await self._routing.generate_route(
            request.lat,
            request.lon,
            waypoints_result.waypoints,
            "foot",
            target_distance_m,
        )

        return RouteSuggestionResponse(
            route_id=str(uuid.uuid4()),
            polyline=polyline,
            distance_m=distance_m,
            estimated_minutes=estimated_minutes,
            waypoints=waypoints_result.waypoints,
            weather=weather,
        )
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
pytest tests/services/test_route_service.py -v
```

Expected: 8 passed

- [ ] **Step 5: コミット**

```bash
git add backend/services/route.py tests/services/test_route_service.py
git commit -m "feat(backend): implement RouteService orchestration (task 5.1)"
```

---

## Task 5.2: slowapi + POST /routes/suggest エンドポイントを実装する

**Files:**
- Create: `backend/limiter.py`
- Create: `backend/routers/routes.py`
- Modify: `backend/main.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: slowapi を requirements.txt に追加する**

`backend/requirements.txt` に追記:
```
slowapi==0.1.9
```

その後インストール:
```bash
pip install slowapi==0.1.9
```

- [ ] **Step 2: 失敗するエンドポイントテストを書く**

```python
# tests/api/test_routes_suggest.py
"""POST /routes/suggest の統合テスト (task 5.2, 5.4)"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.route import RouteSuggestionResponse, WaypointItem, WeatherData

client = TestClient(app)

VALID_BODY = {"lat": 35.0, "lon": 139.0, "distance_km": 5.0, "mode": "walk"}

MOCK_RESPONSE = RouteSuggestionResponse(
    route_id="test-route-id",
    polyline="encoded_poly",
    distance_m=5000,
    estimated_minutes=60,
    waypoints=[WaypointItem(lat=35.1, lon=139.1)],
    weather=WeatherData(temp_c=20.0, condition="晴れ"),
)


def test_suggest_route_returns_200():
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(return_value=MOCK_RESPONSE)
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    assert response.status_code == 200


def test_suggest_route_response_contains_polyline():
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(return_value=MOCK_RESPONSE)
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    data = response.json()
    assert "polyline" in data
    assert data["polyline"] == "encoded_poly"


def test_suggest_route_invalid_lat_returns_422():
    response = client.post(
        "/routes/suggest",
        json={"lat": 999.0, "lon": 139.0, "distance_km": 5.0, "mode": "walk"},
        headers={"X-User-Id": "user-123"},
    )
    assert response.status_code == 422


def test_suggest_route_invalid_lon_returns_422():
    response = client.post(
        "/routes/suggest",
        json={"lat": 35.0, "lon": 999.0, "distance_km": 5.0, "mode": "walk"},
        headers={"X-User-Id": "user-123"},
    )
    assert response.status_code == 422


def test_suggest_route_distance_too_small_returns_422():
    response = client.post(
        "/routes/suggest",
        json={"lat": 35.0, "lon": 139.0, "distance_km": 0.1, "mode": "walk"},
        headers={"X-User-Id": "user-123"},
    )
    assert response.status_code == 422


def test_suggest_route_external_service_error_returns_503():
    import httpx
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_request = httpx.Request("GET", "https://example.com")
        mock_response = httpx.Response(500, request=mock_request)
        mock_svc.suggest = AsyncMock(
            side_effect=httpx.HTTPStatusError("error", request=mock_request, response=mock_response)
        )
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    assert response.status_code == 503


def test_suggest_route_timeout_returns_503():
    import asyncio
    with patch("backend.routers.routes._route_service") as mock_svc:
        mock_svc.suggest = AsyncMock(side_effect=asyncio.TimeoutError())
        response = client.post(
            "/routes/suggest",
            json=VALID_BODY,
            headers={"X-User-Id": "user-123"},
        )
    assert response.status_code == 503
```

- [ ] **Step 3: テストが失敗することを確認する**

```bash
pytest tests/api/test_routes_suggest.py -v
```

Expected: `ModuleNotFoundError` or `404 Not Found`

- [ ] **Step 4: backend/limiter.py を作成する**

```python
# backend/limiter.py
from fastapi import Request
from slowapi import Limiter


def _get_user_id(request: Request) -> str:
    return request.headers.get("X-User-Id") or (request.client.host if request.client else "anonymous")


limiter = Limiter(key_func=_get_user_id)
```

- [ ] **Step 5: backend/routers/routes.py を作成する**

```python
# backend/routers/routes.py
import asyncio
import logging

import httpx
from fastapi import APIRouter, Header, HTTPException, Request

from backend.limiter import limiter
from backend.models.route import RouteRequest, RouteSuggestionResponse
from backend.services.ai import AIService
from backend.services.history import HistoryService
from backend.services.route import RouteService
from backend.services.routing import RoutingService
from backend.services.weather import WeatherService

logger = logging.getLogger(__name__)

router = APIRouter()

_route_service = RouteService(
    weather_service=WeatherService(),
    history_service=HistoryService(),
    ai_service=AIService(),
    routing_service=RoutingService(),
)


@router.post("/routes/suggest", response_model=RouteSuggestionResponse, status_code=200)
@limiter.limit("10/minute")
async def suggest_route(
    request: Request,
    body: RouteRequest,
    x_user_id: str = Header(default="anonymous"),
) -> RouteSuggestionResponse:
    logger.info(
        "Route suggestion request: area=%.1f,%.1f dist=%.1fkm mode=%s",
        body.lat,
        body.lon,
        body.distance_km,
        body.mode,
    )
    try:
        return await asyncio.wait_for(_route_service.suggest(body, x_user_id), timeout=28.0)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="Request timed out")
    except (httpx.TimeoutException, httpx.HTTPStatusError):
        raise HTTPException(status_code=503, detail="External service unavailable")
    except Exception:
        logger.exception("Unexpected error in suggest_route")
        raise HTTPException(status_code=503, detail="Service unavailable")
```

- [ ] **Step 6: backend/main.py を更新する**

```python
# backend/main.py
from fastapi import FastAPI
from mangum import Mangum
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.limiter import limiter
from backend.routers import health, routes

app = FastAPI(title="Walk Jog Route API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(health.router)
app.include_router(routes.router)

handler = Mangum(app, lifespan="off")
```

- [ ] **Step 7: テストが通ることを確認する**

```bash
pytest tests/api/test_routes_suggest.py -v
```

Expected: 7 passed

- [ ] **Step 8: コミット**

```bash
git add backend/limiter.py backend/routers/routes.py backend/main.py backend/requirements.txt tests/api/test_routes_suggest.py
git commit -m "feat(backend): implement POST /routes/suggest endpoint with rate limiting (tasks 5.2-5.4)"
```

---

## Task 6: ルート実行 API を実装する（start + track）

**Files:**
- Modify: `backend/models/route.py`
- Create: `backend/routers/route_execution.py`
- Modify: `backend/main.py`
- Create: `tests/api/test_route_execution.py`

- [ ] **Step 1: 不足モデルを models/route.py に追加する**

`backend/models/route.py` の末尾に追記:

```python
class StartRouteRequest(BaseModel):
    polyline: str
    distance_km: float = Field(ge=0.5, le=50)
    mode: Literal["walk", "jog"]
    weather: WeatherData | None = None


class StartRouteResponse(BaseModel):
    route_id: str
    started_at: str  # ISO8601


class TrackResponse(BaseModel):
    saved_count: int
```

- [ ] **Step 2: 失敗するテストを書く**

```python
# tests/api/test_route_execution.py
"""ルート実行 API のテスト (task 6.1, 6.2)"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

HEADERS = {"X-User-Id": "user-123"}
START_BODY = {
    "polyline": "encoded_poly",
    "distance_km": 5.0,
    "mode": "walk",
    "weather": {"temp_c": 20.0, "condition": "晴れ"},
}
TRACK_BODY = {
    "points": [
        {"lat": 35.0, "lon": 139.0, "timestamp": "2026-05-20T09:01:00"},
        {"lat": 35.01, "lon": 139.01, "timestamp": "2026-05-20T09:02:00"},
    ],
    "status": "tracking",
    "started_at": "2026-05-20T09:00:00",
}


def test_start_route_returns_201():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.save_route = MagicMock()
        response = client.post("/routes/test-route-id/start", json=START_BODY, headers=HEADERS)
    assert response.status_code == 201


def test_start_route_response_contains_route_id():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.save_route = MagicMock()
        response = client.post("/routes/test-route-id/start", json=START_BODY, headers=HEADERS)
    data = response.json()
    assert data["route_id"] == "test-route-id"


def test_start_route_response_contains_started_at():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.save_route = MagicMock()
        response = client.post("/routes/test-route-id/start", json=START_BODY, headers=HEADERS)
    data = response.json()
    assert "started_at" in data
    assert data["started_at"].startswith("2026")  # ISO8601 形式


def test_track_route_returns_200():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.update_track = MagicMock()
        response = client.post("/routes/test-route-id/track", json=TRACK_BODY, headers=HEADERS)
    assert response.status_code == 200


def test_track_route_returns_saved_count():
    with patch("backend.routers.route_execution._history_service") as mock_hist:
        mock_hist.update_track = MagicMock()
        response = client.post("/routes/test-route-id/track", json=TRACK_BODY, headers=HEADERS)
    data = response.json()
    assert data["saved_count"] == 2


def test_track_route_invalid_status_returns_422():
    invalid_body = {**TRACK_BODY, "status": "invalid_status"}
    response = client.post("/routes/test-route-id/track", json=invalid_body, headers=HEADERS)
    assert response.status_code == 422
```

- [ ] **Step 3: テストが失敗することを確認する**

```bash
pytest tests/api/test_route_execution.py -v
```

Expected: `404 Not Found`（ルーターが未登録）

- [ ] **Step 4: backend/routers/route_execution.py を作成する**

```python
# backend/routers/route_execution.py
from datetime import datetime, timezone

from fastapi import APIRouter, Header

from backend.models.route import StartRouteRequest, StartRouteResponse, TrackRequest, TrackResponse
from backend.services.history import HistoryService

router = APIRouter()

_history_service = HistoryService()


@router.post("/routes/{route_id}/start", response_model=StartRouteResponse, status_code=201)
async def start_route(
    route_id: str,
    body: StartRouteRequest,
    x_user_id: str = Header(default="anonymous"),
) -> StartRouteResponse:
    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    weather_dict = body.weather.model_dump() if body.weather else None
    _history_service.save_route(
        user_id=x_user_id,
        route_id=route_id,
        started_at=started_at,
        polyline=body.polyline,
        distance_km=body.distance_km,
        mode=body.mode,
        weather=weather_dict,
    )
    return StartRouteResponse(route_id=route_id, started_at=started_at)


@router.post("/routes/{route_id}/track", response_model=TrackResponse, status_code=200)
async def track_route(
    route_id: str,
    body: TrackRequest,
    x_user_id: str = Header(default="anonymous"),
) -> TrackResponse:
    _history_service.update_track(
        user_id=x_user_id,
        route_id=route_id,
        started_at=body.started_at,
        points=body.points,
        status=body.status,
    )
    return TrackResponse(saved_count=len(body.points))
```

- [ ] **Step 5: TrackRequest に started_at を追加する**

`backend/models/route.py` の `TrackRequest` を修正:

```python
class TrackRequest(BaseModel):
    points: list[TrackPoint]
    status: Literal["tracking", "completed", "abandoned"]
    started_at: str  # ISO8601 — POST /start のレスポンスから取得
```

- [ ] **Step 6: main.py に route_execution ルーターを追加する**

`backend/main.py` を修正:

```python
from backend.routers import health, route_execution, routes

# ... 既存コードの後に追加
app.include_router(route_execution.router)
```

- [ ] **Step 7: テストが通ることを確認する**

```bash
pytest tests/api/test_route_execution.py -v
```

Expected: 6 passed

- [ ] **Step 8: コミット**

```bash
git add backend/models/route.py backend/routers/route_execution.py backend/main.py tests/api/test_route_execution.py
git commit -m "feat(backend): implement route execution API - start and track endpoints (task 6)"
```

---

## Task 7: ルート履歴 API を実装する

**Files:**
- Create: `backend/routers/history.py`
- Modify: `backend/main.py`
- Create: `tests/api/test_history.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# tests/api/test_history.py
"""GET /routes/history の統合テスト (task 7.1)"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
HEADERS = {"X-User-Id": "user-123"}

MOCK_HISTORY = [
    {
        "route_id": "r1",
        "started_at": "2026-05-19T09:00:00",
        "mode": "walk",
        "distance_km": 4.0,
        "has_track": False,
        "polyline": "enc1",
    },
    {
        "route_id": "r2",
        "started_at": "2026-05-18T08:00:00",
        "mode": "jog",
        "distance_km": 8.0,
        "has_track": True,
        "polyline": "enc2",
    },
]


def test_history_returns_200():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=MOCK_HISTORY)
        response = client.get("/routes/history", headers=HEADERS)
    assert response.status_code == 200


def test_history_returns_list():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=MOCK_HISTORY)
        response = client.get("/routes/history", headers=HEADERS)
    data = response.json()
    assert isinstance(data["routes"], list)
    assert len(data["routes"]) == 2


def test_history_item_has_required_fields():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=MOCK_HISTORY)
        response = client.get("/routes/history", headers=HEADERS)
    item = response.json()["routes"][0]
    for field in ["route_id", "started_at", "mode", "distance_km", "has_track", "polyline"]:
        assert field in item


def test_history_empty_returns_empty_list():
    with patch("backend.routers.history._history_service") as mock_hist:
        mock_hist.get_recent = MagicMock(return_value=[])
        response = client.get("/routes/history", headers=HEADERS)
    assert response.json()["routes"] == []
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
pytest tests/api/test_history.py -v
```

Expected: 404 Not Found

- [ ] **Step 3: backend/routers/history.py を作成する**

```python
# backend/routers/history.py
from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.models.route import RouteHistoryItem
from backend.services.history import HistoryService

router = APIRouter()
_history_service = HistoryService()


class HistoryResponse(BaseModel):
    routes: list[RouteHistoryItem]


@router.get("/routes/history", response_model=HistoryResponse)
async def get_history(
    x_user_id: str = Header(default="anonymous"),
) -> HistoryResponse:
    items = _history_service.get_recent(user_id=x_user_id, n=20)
    routes = [RouteHistoryItem(**item) for item in items]
    return HistoryResponse(routes=routes)
```

- [ ] **Step 4: main.py に history ルーターを追加する**

`backend/main.py` を修正:

```python
from backend.routers import health, history, route_execution, routes

# ...
app.include_router(history.router)
```

最終的な `backend/main.py` の完全な内容:

```python
from fastapi import FastAPI
from mangum import Mangum
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.limiter import limiter
from backend.routers import health, history, route_execution, routes

app = FastAPI(title="Walk Jog Route API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(health.router)
app.include_router(routes.router)
app.include_router(route_execution.router)
app.include_router(history.router)

handler = Mangum(app, lifespan="off")
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
pytest tests/api/test_history.py -v
```

Expected: 4 passed

- [ ] **Step 6: 全テストが通ることを確認する**

```bash
pytest -v
```

Expected: 全テストパス（既存52件 + 新規約20件）

- [ ] **Step 7: コミット**

```bash
git add backend/routers/history.py backend/main.py tests/api/test_history.py
git commit -m "feat(backend): implement GET /routes/history endpoint (task 7.1)"
```

---

## Task 8: フロントエンド基盤を構築する

**Files:**
- Create: `frontend/` (Vite + React + TypeScript)
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/routes.ts`
- Create: `frontend/src/hooks/useGeolocation.ts`
- Create: `frontend/src/utils/userId.ts`
- Create: `frontend/src/types/route.ts`

- [ ] **Step 1: Vite + React + TypeScript プロジェクトを初期化する**

```bash
cd /home/onom/walk-jog-route
pnpm create vite frontend --template react-ts
cd frontend
pnpm install
pnpm add react-leaflet leaflet
pnpm add -D @types/leaflet vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: frontend/src/types/route.ts を作成する**

```typescript
// frontend/src/types/route.ts
export type Mode = "walk" | "jog";

export interface RouteRequest {
  lat: number;
  lon: number;
  distance_km: number;
  mode: Mode;
}

export interface WaypointItem {
  lat: number;
  lon: number;
}

export interface WeatherData {
  temp_c: number;
  condition: string;
}

export interface RouteSuggestionResponse {
  route_id: string;
  polyline: string;
  distance_m: number;
  estimated_minutes: number;
  waypoints: WaypointItem[];
  weather: WeatherData | null;
}

export interface RouteHistoryItem {
  route_id: string;
  started_at: string;
  mode: Mode;
  distance_km: number;
  has_track: boolean;
  polyline: string;
}
```

- [ ] **Step 3: frontend/src/utils/userId.ts を作成する**

```typescript
// frontend/src/utils/userId.ts
const USER_ID_KEY = "walkJogUserId";

export function getUserId(): string {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const newId = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, newId);
  return newId;
}
```

- [ ] **Step 4: frontend/src/api/client.ts を作成する**

```typescript
// frontend/src/api/client.ts
import { getUserId } from "../utils/userId";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": getUserId(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 5: frontend/src/api/routes.ts を作成する**

```typescript
// frontend/src/api/routes.ts
import { apiFetch } from "./client";
import type {
  RouteHistoryItem,
  RouteRequest,
  RouteSuggestionResponse,
} from "../types/route";

export async function suggestRoute(
  request: RouteRequest,
): Promise<RouteSuggestionResponse> {
  return apiFetch<RouteSuggestionResponse>("/routes/suggest", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getHistory(): Promise<RouteHistoryItem[]> {
  const data = await apiFetch<{ routes: RouteHistoryItem[] }>("/routes/history");
  return data.routes;
}
```

- [ ] **Step 6: frontend/src/hooks/useGeolocation.ts を作成する**

```typescript
// frontend/src/hooks/useGeolocation.ts
import { useCallback, useEffect, useState } from "react";

type GeolocationError = "denied" | "timeout" | "unavailable" | null;

interface GeolocationState {
  lat: number | null;
  lon: number | null;
  error: GeolocationError;
  loading: boolean;
}

interface UseGeolocationResult extends GeolocationState {
  retry: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lon: null,
    error: null,
    loading: true,
  });

  const request = useCallback(() => {
    setState({ lat: null, lon: null, error: null, loading: true });

    if (!navigator.geolocation) {
      setState({ lat: null, lon: null, error: "unavailable", loading: false });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        const error: GeolocationError =
          err.code === GeolocationPositionError.PERMISSION_DENIED
            ? "denied"
            : err.code === GeolocationPositionError.TIMEOUT
              ? "timeout"
              : "unavailable";
        setState({ lat: null, lon: null, error, loading: false });
      },
      { timeout: 30_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    request();
  }, [request]);

  return { ...state, retry: request };
}
```

- [ ] **Step 7: Vite 設定に vitest を追加する**

`frontend/vite.config.ts` を更新:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

`frontend/src/test/setup.ts` を作成:

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 8: userId utils のテストを書く**

```typescript
// frontend/src/utils/userId.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { getUserId } from "./userId";

describe("getUserId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a string", () => {
    expect(typeof getUserId()).toBe("string");
  });

  it("returns the same id on second call", () => {
    const first = getUserId();
    const second = getUserId();
    expect(first).toBe(second);
  });

  it("generates a valid UUID format", () => {
    const id = getUserId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
```

- [ ] **Step 9: フロントエンドテストが通ることを確認する**

```bash
cd frontend
pnpm test
```

Expected: userId tests 3 passed

- [ ] **Step 10: 開発サーバーが起動することを確認する**

```bash
pnpm dev
# http://localhost:5173 でアクセス確認
```

- [ ] **Step 11: コミット**

```bash
cd /home/onom/walk-jog-route
git add frontend/
git commit -m "feat(mobile): initialize frontend foundation with API client and useGeolocation hook (tasks 8.1-8.4)"
```

---

## 完了後の検証

```bash
# バックエンド全テスト
cd /home/onom/walk-jog-route
pytest -v --tb=short

# フロントエンドテスト
cd frontend && pnpm test

# バックエンドローカル起動確認
cd /home/onom/walk-jog-route
uvicorn backend.main:app --reload
# → http://localhost:8000/health で {"status": "ok"}
# → http://localhost:8000/docs で Swagger UI
```

---

## 次のタスク（本プラン完了後）

- Task 9: ルート提案画面（RouteMap + RouteRequestForm + Home ページ）
- Task 10: ルート実行画面（useRouteTracking + ActiveRoute ページ）
- Task 11: ルート履歴画面（RouteCard + History ページ）
- Task 12: セキュリティ確認（422 テスト・ログ座標精度確認）
- Task 13: デプロイ設定（CDK + Amplify）
