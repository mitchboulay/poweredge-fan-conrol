"""Parsing, curve math and the failsafes. Run: python -m pytest -q (or python test_controller.py)."""
import asyncio
import tempfile
from pathlib import Path

import controller as c
from ipmi import IpmiError, Reading, parse_sdr

TEMPS = """\
Inlet Temp       | 04h | ok  |  7.1 | 25 degrees C
Exhaust Temp     | 01h | ok  |  7.1 | 35 degrees C
Temp             | 0Eh | ok  |  3.1 | 49 degrees C
Temp             | 0Fh | ok  |  3.2 | 48 degrees C
"""
FANS = """\
Fan1             | 30h | ok  |  7.1 | 4080 RPM
Fan2             | 31h | ok  |  7.1 | 3960 RPM
Fan Redundancy   | 75h | ok  |  7.1 | Fully Redundant
"""


class FakeIpmi:
    def __init__(self, cpu=49, fail=False, flag=False):
        self.cpu, self.fail, self.flag = cpu, fail, flag
        self.calls: list = []

    async def temperatures(self):
        if self.fail:
            raise IpmiError("timeout")
        return [Reading("Exhaust Temp", 35, not self.flag), Reading("CPU 1", self.cpu, True)]

    async def fans(self):
        return [Reading("Fan1", 4000, True)]

    async def set_dell_auto(self):
        self.calls.append("auto")

    async def set_fixed(self, percent):
        self.calls.append(percent)


def make(fake, **settings):
    ctl = c.Controller(fake, Path(tempfile.mkdtemp()) / "settings.json")
    ctl.settings = c.Settings(**settings)
    return ctl


def test_parse_sdr_names_cpus_by_entity_and_skips_non_numeric():
    temps = parse_sdr(TEMPS, "degrees C")
    assert [(t.name, t.value) for t in temps] == [("Inlet Temp", 25), ("Exhaust Temp", 35), ("CPU 1", 49), ("CPU 2", 48)]
    assert [f.value for f in parse_sdr(FANS, "RPM")] == [4080, 3960]
    assert not parse_sdr("Temp | 0Eh | cr | 3.1 | 90 degrees C", "degrees C")[0].ok


def test_curve_interpolates_and_clamps():
    curve = [c.CurvePoint(temp_c=40, percent=10), c.CurvePoint(temp_c=60, percent=30)]
    assert c.curve_percent(curve, 30) == 10
    assert c.curve_percent(curve, 50) == 20
    assert c.curve_percent(curve, 90) == 30


def test_settings_reject_falling_or_unordered_curves():
    for bad in ([(50, 20), (40, 30)], [(40, 30), (50, 20)]):
        try:
            c.Settings(mode="curve", curve=[{"temp_c": t, "percent": p} for t, p in bad])
        except ValueError:
            continue
        raise AssertionError(bad)


def test_curve_mode_sets_speed_and_ramps_down_slowly():
    fake = FakeIpmi(cpu=72)
    ctl = make(fake, mode="curve")
    asyncio.run(ctl.tick())
    assert fake.calls == [45]
    fake.cpu = 40
    asyncio.run(ctl.tick())  # still within the 1-min window of the 72 °C reading
    assert ctl.applied == 45


def test_hot_cpu_hands_to_dell_until_it_cools():
    fake = FakeIpmi(cpu=c.FAILSAFE_C)
    ctl = make(fake, mode="fixed", fixed_percent=20)
    asyncio.run(ctl.tick())
    assert fake.calls == ["auto"] and ctl.failsafe and ctl.settings.mode == "fixed"
    fake.cpu = c.RESUME_C  # cooler, but not cool enough yet
    asyncio.run(ctl.tick())
    assert fake.calls == ["auto"] and ctl.failsafe
    fake.cpu = c.RESUME_C - 1
    asyncio.run(ctl.tick())
    assert fake.calls == ["auto", 20] and ctl.failsafe is None


def test_flagged_sensor_hands_back_to_dell():
    fake = FakeIpmi(flag=True)
    ctl = make(fake, mode="fixed", fixed_percent=20)
    asyncio.run(ctl.tick())
    assert fake.calls == ["auto"] and "Exhaust Temp" in ctl.failsafe


def test_lost_idrac_hands_back_to_dell_after_retries():
    fake = FakeIpmi()
    ctl = make(fake, mode="fixed", fixed_percent=20)
    asyncio.run(ctl.tick())
    fake.fail = True
    for _ in range(c.MAX_FAILURES):
        asyncio.run(ctl.tick())
    assert fake.calls == [20, "auto"] and ctl.failsafe
    fake.fail = False
    asyncio.run(ctl.tick())
    assert fake.calls == [20, "auto", 20] and ctl.failsafe is None


def test_quiet_curve_is_the_default():
    assert c.Settings().mode == "curve"


def test_settings_survive_restart():
    fake = FakeIpmi()
    ctl = make(fake)
    asyncio.run(ctl.update(c.Settings(mode="fixed", fixed_percent=30)))
    assert c.Controller(fake, ctl.state_path).settings.fixed_percent == 30


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("ok")
