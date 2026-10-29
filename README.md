# Fans — PowerEdge R730 fan control

`https://fans.home.mbotech.net` (LAN only, no auth). Watches the R730's
temperatures and fans through its iDRAC (`192.168.1.98`, IPMI over LAN) and
controls the fans in one of three modes:

- **Curve** (the default): the app sets the speed from the hottest CPU,
  following a curve you drag into shape. It speeds up right away and slows
  down only after the CPU has been cooler for a minute.
- **Fixed**: one speed for all six fans.
- **Dell auto**: the iDRAC decides. Safe, loud.

Temperatures show in °F (switch to °C in the header; the backend and API are °C).

## Safety

Dell takes the fans for as long as the app can't be sure the server is safe,
then the app takes them back on its own, so a hiccup never leaves it loud:

| Trigger | Dell has the fans until |
|---|---|
| a CPU reaches 85 °C (`FAILSAFE_C`) | the CPUs are below 75 °C (`RESUME_C`) |
| the iDRAC flags a temperature sensor | the flag clears |
| three sensor reads in a row fail | a read succeeds |
| the app stops or redeploys | it starts again |

Your chosen mode is never changed by a failsafe; the page shows an amber note
while one is active. While a fixed speed or a curve is active, the speed is
re-sent every minute in case the iDRAC reset itself.

The curve only sees the CPUs, inlet and exhaust: drives and PCIe cards have no
IPMI sensor here, so don't set the floor too low if you add hot cards.

## How it talks to the iDRAC

`ipmitool -I lanplus` with the password passed in the environment (`-E`), one
call at a time. Readings come from `sdr type temperature` and `sdr type fan`.
Control uses Dell's OEM raw commands, which work on iDRAC7/8 (this one runs
2.86) but were removed in iDRAC9 3.30+:

| | |
|---|---|
| Dell auto | `raw 0x30 0x30 0x01 0x01` |
| Manual | `raw 0x30 0x30 0x01 0x00` |
| Set all fans to N % | `raw 0x30 0x30 0x02 0xff 0x<N hex>` |

The iDRAC can't report which mode it's in, so the app tracks that itself.

The iDRAC uses its **dedicated** port. If the page says it can't reach the
iDRAC, check that port has link: `ipmitool delloem lan get active` on the
Proxmox host prints `None` when it doesn't.

## Run / deploy

Coolify app `fan-control` on CT 124 builds `main` on every push (Forgejo
webhook) and publishes host port 18098; Caddy proxies `fans.home.mbotech.net`
to it. Env vars `IDRAC_ADDRESS`, `IDRAC_USER` and `IDRAC_PASSWORD` are set in
Coolify. Mode and curve persist in the `fan-control-data` volume.

Locally:

```bash
cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt pytest
.venv/bin/python -m pytest -q
IDRAC_PASSWORD=... STATE_PATH=/tmp/fans.json .venv/bin/uvicorn app:app --port 8000
cd ../frontend && npm install && npm run dev    # proxies /api to :8000
```

Running it locally controls the real server, just like production. Don't run
both at once: two controllers would fight over the fans.

## API

- `GET /api/status`: settings, applied speed, sensors, last hour of history
- `PUT /api/settings`: `{mode: "auto"|"fixed"|"curve", fixed_percent, curve: [{temp_c, percent}]}`
- `GET /healthz`
