"""MCP tools for the fan controller (streamable HTTP at /mcp, LAN-only, no auth)."""
from __future__ import annotations

from typing import Literal

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from controller import Controller, CurvePoint, Settings


def build(controller: Controller) -> FastMCP:
    mcp = FastMCP(
        "fans",
        instructions=(
            "Fan control for the PowerEdge R730 homelab server (iDRAC8). Temperatures are °C. "
            "Modes: 'curve' (default, quiet: speed follows the hottest CPU), 'fixed' (one speed), "
            "'auto' (Dell's iDRAC decides; safe but loud). The app hands the fans to Dell on its own "
            "while a CPU is at 85 °C, a sensor is flagged or the iDRAC is unreachable, then resumes."
        ),
        stateless_http=True,
        json_response=True,
        streamable_http_path="/",
        # Reached as fans.home.mbotech.net through Caddy; the LAN is the boundary.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )

    def summary() -> dict:
        status = controller.status()
        status.pop("history")
        return status

    @mcp.tool()
    def get_status() -> dict:
        """Current mode, applied fan %, every temperature and fan RPM, and any active failsafe."""
        return summary()

    @mcp.tool()
    def get_history(minutes: int = 60) -> list[dict]:
        """Hottest CPU (°C) and average fan RPM over the last `minutes` (max 60), oldest first."""
        history = controller.status()["history"]
        if not history:
            return []
        since = history[-1]["t"] - max(1, min(minutes, 60)) * 60
        return [h for h in history if h["t"] >= since]

    @mcp.tool()
    async def set_mode(mode: Literal["auto", "fixed", "curve"]) -> dict:
        """Switch mode, keeping the saved fixed speed and curve."""
        await controller.update(controller.settings.model_copy(update={"mode": mode}))
        return summary()

    @mcp.tool()
    async def set_fixed_speed(percent: int) -> dict:
        """Hold all fans at `percent` (5-100) and switch to fixed mode."""
        await controller.update(Settings(**{**controller.settings.model_dump(), "mode": "fixed", "fixed_percent": percent}))
        return summary()

    @mcp.tool()
    async def set_curve(points: list[CurvePoint]) -> dict:
        """Replace the curve and switch to curve mode. 2-8 points of {temp_c: 20-95, percent: 5-100};
        temperatures must increase and speeds must not drop. Beyond either end the speed stays flat."""
        await controller.update(Settings(**{**controller.settings.model_dump(), "mode": "curve", "curve": points}))
        return summary()

    return mcp
