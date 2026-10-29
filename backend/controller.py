"""Fan control loop: Dell auto, a fixed speed, or a temperature curve.

Every POLL_S it reads the sensors and (in fixed/curve mode) sets the fans. It
hands control to Dell while it can't be sure the server is safe (a CPU at
FAILSAFE_C, any sensor the iDRAC flags, the iDRAC going quiet) and takes it
back, quietly, once that clears.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import deque
from pathlib import Path
from typing import Literal, Protocol

from pydantic import BaseModel, Field, model_validator

from ipmi import IpmiError, Reading

log = logging.getLogger("fans")

POLL_S = 10
REASSERT_S = 60       # re-send manual speed in case the iDRAC reset itself to auto
DOWN_WINDOW = 6       # curve follows the hottest of the last 6 polls: up fast, down after ~1 min
FAILSAFE_C = 85       # E5-2600 v3/v4 Tcase is 76-86 °C
RESUME_C = 75         # after a heat failsafe, Dell keeps the fans until the CPUs are below this
MAX_FAILURES = 3
HISTORY_LEN = 360     # 1 h at POLL_S


class Ipmi(Protocol):
    async def temperatures(self) -> list[Reading]: ...
    async def fans(self) -> list[Reading]: ...
    async def set_dell_auto(self) -> None: ...
    async def set_fixed(self, percent: int) -> None: ...


class CurvePoint(BaseModel):
    temp_c: int = Field(ge=20, le=95)
    percent: int = Field(ge=5, le=100)


DEFAULT_CURVE = [CurvePoint(temp_c=t, percent=p) for t, p in ((40, 10), (55, 15), (65, 25), (72, 45), (80, 100))]


class Settings(BaseModel):
    mode: Literal["auto", "fixed", "curve"] = "curve"  # quiet by default
    fixed_percent: int = Field(default=25, ge=5, le=100)
    curve: list[CurvePoint] = Field(default_factory=lambda: list(DEFAULT_CURVE), min_length=2, max_length=8)

    @model_validator(mode="after")
    def _curve_rises(self) -> Settings:
        for a, b in zip(self.curve, self.curve[1:]):
            if b.temp_c <= a.temp_c:
                raise ValueError("Curve temperatures must increase from point to point.")
            if b.percent < a.percent:
                raise ValueError("Fan speed can't drop as the temperature rises.")
        return self


def curve_percent(curve: list[CurvePoint], temp_c: float) -> int:
    """Linear interpolation, flat beyond either end."""
    if temp_c <= curve[0].temp_c:
        return curve[0].percent
    for a, b in zip(curve, curve[1:]):
        if temp_c <= b.temp_c:
            return round(a.percent + (b.percent - a.percent) * (temp_c - a.temp_c) / (b.temp_c - a.temp_c))
    return curve[-1].percent


def _hottest_cpu(temps: list[Reading]) -> int | None:
    cpus = [t.value for t in temps if t.name.startswith("CPU")] or [t.value for t in temps]
    return max(cpus, default=None)


class Controller:
    def __init__(self, ipmi: Ipmi, state_path: Path) -> None:
        self.ipmi = ipmi
        self.state_path = state_path
        self.settings = self._load()
        self.temps: list[Reading] = []
        self.fans: list[Reading] = []
        self.history: deque[dict] = deque(maxlen=HISTORY_LEN)
        self.recent_cpu: deque[int] = deque(maxlen=DOWN_WINDOW)
        self.applied: int | None = None   # percent we hold, None = Dell's control
        self.synced = False               # unknown at startup: the iDRAC can't be asked
        self.applied_at = 0.0
        self.updated_at: float | None = None
        self.error: str | None = None
        self.failsafe: str | None = None  # set while Dell has the fans on our behalf
        self.failures = 0
        self._lock = asyncio.Lock()

    # ---- settings ----------------------------------------------------------

    def _load(self) -> Settings:
        try:
            return Settings.model_validate_json(self.state_path.read_text())
        except FileNotFoundError:
            return Settings()
        except ValueError:
            log.warning("Ignoring unreadable %s", self.state_path)
            return Settings()

    def _save(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(self.settings.model_dump_json(indent=2))
        os.replace(tmp, self.state_path)

    async def update(self, settings: Settings) -> None:
        async with self._lock:
            self.settings = settings
            self._save()
            self.failsafe = None
            log.info("Settings: %s", settings.model_dump_json())
            if self.temps or settings.mode == "auto":
                await self._apply(self._target())

    # ---- loop --------------------------------------------------------------

    async def run(self) -> None:
        while True:
            try:
                await self.tick()
            except Exception:  # keep the loop alive whatever happens; tick already fails safe
                log.exception("Tick failed")
            await asyncio.sleep(POLL_S)

    async def tick(self) -> None:
        async with self._lock:
            try:
                temps = await self.ipmi.temperatures()
                fans = await self.ipmi.fans()
            except IpmiError as exc:
                self.failures += 1
                self.error = str(exc)
                log.warning("Read failed (%d): %s", self.failures, exc)
                if self.failures >= MAX_FAILURES and self.settings.mode != "auto":
                    await self._fail_safe(f"Lost contact with the iDRAC {self.failures} times in a row")
                return

            self.failures, self.error = 0, None
            self.temps, self.fans, self.updated_at = temps, fans, time.time()
            cpu = _hottest_cpu(temps)
            if cpu is not None:
                self.recent_cpu.append(cpu)
            self.history.append({
                "t": int(self.updated_at),
                "cpu": cpu,
                "rpm": round(sum(f.value for f in fans) / len(fans)) if fans else None,
            })

            if self.settings.mode != "auto":
                flagged = [t.name for t in temps if not t.ok]
                limit = RESUME_C if self.failsafe else FAILSAFE_C  # hysteresis: no flapping at the line
                if cpu is not None and cpu >= limit:
                    return await self._fail_safe(f"CPU at {cpu} °C")
                if flagged:
                    return await self._fail_safe(f"The iDRAC flagged {', '.join(flagged)}")
                if self.failsafe:
                    log.info("Failsafe cleared (%s): resuming %s", self.failsafe, self.settings.mode)
                    self.failsafe = None
            await self._apply(self._target())

    def _target(self) -> int | None:
        s = self.settings
        if s.mode == "fixed":
            return s.fixed_percent
        if s.mode == "curve" and self.recent_cpu:
            return curve_percent(s.curve, max(self.recent_cpu))
        return None

    async def _apply(self, target: int | None) -> None:
        now = time.monotonic()
        if target is None:
            if self.applied is not None or not self.synced:
                await self.ipmi.set_dell_auto()
                log.info("Fans: Dell auto")
        elif target != self.applied or not self.synced or now - self.applied_at >= REASSERT_S:
            await self.ipmi.set_fixed(target)
            if target != self.applied:
                log.info("Fans: %d%%", target)
        self.applied, self.synced, self.applied_at = target, True, now

    async def _fail_safe(self, reason: str) -> None:
        """Dell takes the fans until the next tick finds things safe; the saved mode is kept."""
        if self.failsafe is None:
            log.error("Failsafe: %s — handing fans to Dell", reason)
        self.failsafe = reason
        try:
            await self._apply(None)
        except IpmiError as exc:
            self.synced = False  # retried on the next good tick
            log.error("Couldn't restore Dell auto: %s", exc)

    async def release(self) -> None:
        """On shutdown: never leave the fans pinned while nothing is watching."""
        if self.applied is not None:
            try:
                await self.ipmi.set_dell_auto()
                log.info("Shutdown: fans back to Dell auto")
            except IpmiError as exc:
                log.error("Shutdown: couldn't restore Dell auto: %s", exc)

    # ---- API view ----------------------------------------------------------

    def status(self) -> dict:
        return {
            "settings": self.settings.model_dump(),
            "applied_percent": self.applied,
            "hottest_cpu": _hottest_cpu(self.temps),
            "temperatures": [{"name": t.name, "value": t.value, "ok": t.ok} for t in self.temps],
            "fans": [{"name": f.name, "rpm": f.value, "ok": f.ok} for f in self.fans],
            "updated_at": self.updated_at,
            "poll_seconds": POLL_S,
            "failsafe_c": FAILSAFE_C,
            "error": self.error,
            "failsafe": self.failsafe,
            "history": list(self.history),
        }
