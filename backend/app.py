"""Fans: R730 fan control — Dell auto, a fixed speed, or a temperature curve."""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import ipmi
import mcp_server
from controller import Controller, Settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

controller = Controller(ipmi, Path(os.environ.get("STATE_PATH", "/data/settings.json")))
mcp = mcp_server.build(controller)


@asynccontextmanager
async def lifespan(_: FastAPI):
    loop = asyncio.create_task(controller.run())
    async with mcp.session_manager.run():
        yield
    loop.cancel()
    await controller.release()


app = FastAPI(title="Fans", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.exception_handler(ipmi.IpmiError)
def ipmi_error(_: Request, exc: ipmi.IpmiError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"Can't reach the iDRAC: {exc}"})


@app.get("/api/status")
def status() -> dict:
    return controller.status()


@app.put("/api/settings")
async def put_settings(body: Settings) -> dict:
    await controller.update(body)
    return controller.status()


@app.get("/api/metrics")
def metrics() -> dict:
    """Flat numbers for Telegraf (homelab observability -> Grafana)."""
    s = controller.status()
    return {
        "mode": s["settings"]["mode"],
        "applied_percent": s["applied_percent"] if s["applied_percent"] is not None else -1,  # -1 = Dell has the fans
        "failsafe": int(s["failsafe"] is not None),
        "idrac_error": int(s["error"] is not None),
        "hottest_cpu_c": s["hottest_cpu"],
    }


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


app.mount("/mcp", mcp.streamable_http_app())

# Serve the SPA. Mounted last so /api/*, /mcp and /healthz win.
if Path("static").is_dir():
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
