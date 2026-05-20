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
