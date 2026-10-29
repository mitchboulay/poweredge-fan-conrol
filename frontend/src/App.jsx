import { useState } from "react";
import { CurveChart, History } from "./charts.jsx";
import { api, Banner, Card, Segmented, SectionTitle, Spinner, toUnit, usePolled, useUnit } from "./ui.jsx";

const MODES = [
  { key: "auto", label: "Dell auto" },
  { key: "curve", label: "Curve" },
  { key: "fixed", label: "Fixed" },
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function describe(status) {
  const { mode } = status.settings;
  const pct = status.applied_percent;
  if (mode === "auto") return "Dell is controlling the fans";
  if (status.failsafe) return "Dell has the fans until it's safe again";
  if (pct == null) return "Taking over from Dell…";
  return mode === "curve" ? `Following your curve · ${pct}%` : `Holding ${pct}%`;
}

function StatusCard({ status, busy, unit }) {
  const stale = status.updated_at == null || Date.now() / 1000 - status.updated_at > status.poll_seconds * 4;
  const dot = status.error || stale ? "bg-rose-500" : status.failsafe ? "bg-amber-400"
    : status.settings.mode === "auto" ? "bg-slate-400" : "bg-emerald-500";
  const avgRpm = status.fans.length ? Math.round(status.fans.reduce((s, f) => s + f.rpm, 0) / status.fans.length) : null;
  return (
    <Card>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Hottest CPU</p>
          <p className="mt-1 text-5xl font-semibold leading-none text-slate-800">
            {status.hottest_cpu != null ? toUnit(status.hottest_cpu, unit) : "—"}<span className="text-2xl text-slate-400">°{unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Fans</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700">
            {avgRpm?.toLocaleString() ?? "—"} <span className="text-sm font-normal text-slate-400">RPM</span>
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        {busy ? <><Spinner className="h-4 w-4" /> Updating…</> : (
          <><span className={"h-2 w-2 rounded-full " + dot} />
            {status.error ? "Can't reach the iDRAC" : stale ? "Waiting for the iDRAC…" : describe(status)}</>
        )}
      </p>
      <History points={status.history} />
    </Card>
  );
}

function CurvePanel({ draft, setDraft, status, unit }) {
  const curve = draft.curve;
  const addPoint = () => {
    // Split the widest temperature gap.
    let gap = 0;
    curve.slice(1).forEach((c, i) => { if (c.temp_c - curve[i].temp_c > curve[gap + 1].temp_c - curve[gap].temp_c) gap = i; });
    const a = curve[gap], b = curve[gap + 1];
    const mid = { temp_c: Math.round((a.temp_c + b.temp_c) / 2), percent: Math.round((a.percent + b.percent) / 2) };
    setDraft({ ...draft, curve: [...curve.slice(0, gap + 1), mid, ...curve.slice(gap + 1)] });
  };
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">
        Drag the points. The fans follow the hottest CPU, speed up right away and slow down after a minute.
        At {toUnit(status.failsafe_c, unit)}°{unit} Dell steps in until it cools down.
      </p>
      <CurveChart curve={curve} onChange={(c) => setDraft({ ...draft, curve: c })} failsafe={status.failsafe_c} unit={unit}
        hottest={status.hottest_cpu} target={status.settings.mode === "curve" ? status.applied_percent : null} />
      <div className="mt-3 flex flex-wrap gap-2">
        {curve.map((c, i) => (
          <span key={i} className="flex items-center gap-1 rounded-lg bg-slate-100 py-1 pl-2.5 pr-1 font-mono text-xs text-slate-600">
            {toUnit(c.temp_c, unit)}° → {c.percent}%
            <button onClick={() => setDraft({ ...draft, curve: curve.filter((_, j) => j !== i) })} disabled={curve.length <= 2}
              aria-label={`Remove ${toUnit(c.temp_c, unit)}° point`} className="rounded px-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:invisible">
              ×
            </button>
          </span>
        ))}
        {curve.length < 8 && (
          <button onClick={addPoint} className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:border-sky-300 hover:text-sky-600">
            + Add point
          </button>
        )}
      </div>
    </>
  );
}

function FixedPanel({ draft, setDraft }) {
  return (
    <>
      <p className="mb-4 text-sm text-slate-500">All six fans hold this speed whatever the temperature, until a CPU gets too hot.</p>
      <div className="flex items-center gap-4">
        <input type="range" min="5" max="100" value={draft.fixed_percent} aria-label="Fan speed"
          onChange={(e) => setDraft({ ...draft, fixed_percent: Number(e.target.value) })}
          className="h-2 flex-1 cursor-pointer accent-sky-500" />
        <span className="w-14 text-right text-2xl font-semibold text-slate-700">{draft.fixed_percent}%</span>
      </div>
    </>
  );
}

function Sensors({ status, unit }) {
  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2">
      <section>
        <SectionTitle>Temperatures</SectionTitle>
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {status.temperatures.map((t) => (
            <li key={t.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-600">{t.name}</span>
              <span className={"font-mono " + (t.ok ? "text-slate-800" : "font-semibold text-rose-600")}>{toUnit(t.value, unit)}°{unit}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <SectionTitle>Fans</SectionTitle>
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {status.fans.map((f) => (
            <li key={f.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-600">{f.name}</span>
              <span className={"font-mono " + (f.ok ? "text-slate-800" : "font-semibold text-rose-600")}>{f.rpm.toLocaleString()} RPM</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function App() {
  const [error, setError] = useState(null);
  const [status, setStatus] = usePolled("/api/status", setError);
  const [draft, setDraft] = useState(null); // unsaved edits to the curve / fixed speed
  const [busy, setBusy] = useState(false);
  const [unit, setUnit] = useUnit();

  const save = async (settings) => {
    setBusy(true); setError(null);
    try {
      setStatus(await api("/api/settings", { method: "PUT", body: settings }));
      setDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <main className="mx-auto flex max-w-xl items-center justify-center gap-2 px-4 py-24 text-sm text-slate-400">
        {error ? <Banner>{error}</Banner> : <><Spinner /> Loading…</>}
      </main>
    );
  }

  const current = draft ?? status.settings;
  const dirty = draft && !same(draft, status.settings);
  const editing = draft?.mode ?? status.settings.mode;

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-800">Fans</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">PowerEdge R730</span>
          <Segmented label="Temperature unit" value={unit} onChange={setUnit}
            options={[{ key: "F", label: "°F" }, { key: "C", label: "°C" }]} />
        </div>
      </header>

      <StatusCard status={status} busy={busy} unit={unit} />
      <Banner tone="amber">{status.failsafe && `Dell has the fans: ${status.failsafe.replace(/(\d+) °C/, (_, c) => `${toUnit(+c, unit)} °${unit}`)}. Your ${status.settings.mode} picks back up on its own once that clears.`}</Banner>
      <Banner>{error}</Banner>

      <section className="mt-8">
        <SectionTitle>Who controls the fans</SectionTitle>
        <Segmented label="Fan mode" options={MODES} value={editing} busy={busy}
          onChange={(mode) => save({ ...current, mode })} />
        {editing !== "auto" && (
          <Card className="mt-4">
            {editing === "curve"
              ? <CurvePanel draft={current} setDraft={setDraft} status={status} unit={unit} />
              : <FixedPanel draft={current} setDraft={setDraft} />}
            {dirty && (
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setDraft(null)} disabled={busy}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">Discard</button>
                <button onClick={() => save(draft)} disabled={busy}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
                  Save
                </button>
              </div>
            )}
          </Card>
        )}
        {editing === "auto" && (
          <p className="mt-3 px-1 text-sm text-slate-500">
            The iDRAC picks the speed. It plays it safe and runs loud; the curve is much quieter.
          </p>
        )}
      </section>

      <Sensors status={status} unit={unit} />
    </main>
  );
}
