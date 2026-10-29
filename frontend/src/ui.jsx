// Shared bits, same look as network.home.mbotech.net.
import { useCallback, useEffect, useState } from "react";

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI validation errors arrive as a list.
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg.replace(/^Value error, /, "")).join(" ") : data.detail;
    throw new Error(detail || "Something went wrong.");
  }
  return data;
}

export function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg className={"animate-spin " + className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}

export function SectionTitle({ children }) {
  return <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</h2>;
}

export function Card({ className = "", children }) {
  return (
    <div className={"rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-slate-100 " + className}>
      {children}
    </div>
  );
}

export function Banner({ tone = "rose", children }) {
  if (!children) return null;
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <div className={"mt-4 rounded-xl border px-4 py-3 text-sm " + tones[tone]}>{children}</div>;
}

export function Segmented({ options, value, busy, onChange, label }) {
  return (
    <div className="flex rounded-xl bg-slate-200/70 p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} role="radio" aria-checked={value === o.key} disabled={busy}
          onClick={() => value !== o.key && onChange(o.key)}
          className={
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-60 " +
            (value === o.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")
          }>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Polls `path` every `ms`; returns [data, setData].
export function usePolled(path, onError, ms = 5000) {
  const [data, setData] = useState(null);
  const load = useCallback(
    () => api(path).then((d) => { setData(d); onError(null); }).catch((e) => onError(e.message)),
    [path, onError]
  );
  useEffect(() => {
    load();
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [load, ms]);
  return [data, setData];
}
