"""The R730's iDRAC over IPMI-over-LAN, via ipmitool."""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

ADDRESS = os.environ.get("IDRAC_ADDRESS", "192.168.1.98")
USER = os.environ.get("IDRAC_USER", "root")
PASSWORD = os.environ.get("IDRAC_PASSWORD", "")
TIMEOUT_S = 20  # one call takes 2-3 s on the LAN; ipmitool retries internally first


class IpmiError(Exception):
    """ipmitool failed or timed out."""


@dataclass(frozen=True)
class Reading:
    name: str
    value: int
    ok: bool  # False once the iDRAC flags the sensor non-critical or worse


# One session at a time: the iDRAC8 has few sessions and stalls under concurrency.
_lock = asyncio.Lock()


async def _run(*args: str) -> str:
    async with _lock:
        proc = await asyncio.create_subprocess_exec(
            "ipmitool", "-I", "lanplus", "-H", ADDRESS, "-U", USER, "-E", *args,
            env={**os.environ, "IPMI_PASSWORD": PASSWORD},  # -E: keeps the password out of argv
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(), TIMEOUT_S)
        except TimeoutError:
            proc.kill()
            await proc.wait()
            raise IpmiError(f"The iDRAC didn't answer within {TIMEOUT_S} s") from None
        if proc.returncode:
            raise IpmiError(err.decode().strip() or f"ipmitool exited {proc.returncode}")
        return out.decode()


def parse_sdr(output: str, unit: str) -> list[Reading]:
    """`sdr type ...` rows like `Temp | 0Eh | ok | 3.1 | 49 degrees C`.

    Both CPU sensors are named "Temp"; entity 3.N (processor N) tells them apart.
    """
    readings = []
    for line in output.splitlines():
        cols = [c.strip() for c in line.split("|")]
        if len(cols) != 5 or not cols[4].endswith(unit):
            continue
        name, status, entity, value = cols[0], cols[2], cols[3], cols[4]
        if entity.startswith("3."):
            name = f"CPU {entity[2:]}"
        readings.append(Reading(name=name, value=int(value.split()[0]), ok=status == "ok"))
    return readings


async def temperatures() -> list[Reading]:
    return parse_sdr(await _run("sdr", "type", "temperature"), "degrees C")


async def fans() -> list[Reading]:
    return parse_sdr(await _run("sdr", "type", "fan"), "RPM")


# Dell OEM raw commands (iDRAC7/8; iDRAC9 >= 3.30 removed them).
# There is no command to read the current mode back: the controller tracks it.
async def set_dell_auto() -> None:
    await _run("raw", "0x30", "0x30", "0x01", "0x01")


async def set_fixed(percent: int) -> None:
    await _run("raw", "0x30", "0x30", "0x01", "0x00")
    await _run("raw", "0x30", "0x30", "0x02", "0xff", f"0x{percent:02x}")
