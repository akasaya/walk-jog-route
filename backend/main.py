from fastapi import FastAPI
from mangum import Mangum

from backend.routers import health

app = FastAPI(title="Walk Jog Route API")
app.include_router(health.router)

handler = Mangum(app, lifespan="off")
