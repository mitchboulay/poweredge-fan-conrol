// Two small SVG charts: the last hour of history, and the draggable fan curve.
import { useRef, useState } from "react";
import { toUnit } from "./ui.jsx";

// Last hour: hottest CPU (sky) and average fan RPM (slate), each on its own scale.
export function History({ points }) {
  const rows = points.filter((p) => p.cpu != null);
  if (rows.length < 2) return null;
  // Minimum spans keep a 1 °C / 120 RPM wobble from filling the whole chart.
  const MIN_SPAN = { cpu: 10, rpm: 2000 };
  const line = (key) => {
    const vals = rows.map((p) => p[key]).filter((v) => v != null);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = Math.max(max - min, MIN_SPAN[key]), lo = (min + max) / 2 - span / 2;
    return rows.map((p, i) => `${(i / (rows.length - 1)) * 100},${p[key] == null ? 50 : 36 - ((p[key] - lo) / span) * 32}`).join(" ");
  };
  const minutes = Math.round((rows.at(-1).t - rows[0].t) / 60);
  return (
    <div className="mt-5">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
        <polyline points={line("rpm")} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <polyline points={line("cpu")} fill="none" stroke="#0ea5e9" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 flex gap-4 text-xs text-slate-400">
        <span><span className="mr-1 inline-block h-0.5 w-3 bg-sky-500 align-middle" />CPU</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 border-t border-dashed border-slate-400 align-middle" />Fans</span>
        <span className="ml-auto">last {minutes < 1 ? "minute" : `${minutes} min`}</span>
      </p>
    </div>
  );
}

const T_MIN = 20, T_MAX = 95;
const W = 320, H = 180, PAD = { l: 34, r: 12, t: 12, b: 26 };
const x = (t) => PAD.l + ((t - T_MIN) / (T_MAX - T_MIN)) * (W - PAD.l - PAD.r);
const y = (p) => H - PAD.b - (p / 100) * (H - PAD.t - PAD.b);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Drag points to shape the curve. Each point stays between its neighbours:
// temperatures strictly increase, speeds never drop.
export function CurveChart({ curve, onChange, hottest, target, failsafe, unit }) {
  const svg = useRef(null);
  const [drag, setDrag] = useState(null);

  const move = (e) => {
    if (drag == null) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current.getScreenCTM().inverse());
    const prev = curve[drag - 1], next = curve[drag + 1];
    const temp_c = clamp(Math.round(T_MIN + ((pt.x - PAD.l) / (W - PAD.l - PAD.r)) * (T_MAX - T_MIN)),
      prev ? prev.temp_c + 1 : T_MIN, next ? next.temp_c - 1 : T_MAX);
    const percent = clamp(Math.round(((H - PAD.b - pt.y) / (H - PAD.t - PAD.b)) * 100),
      prev ? prev.percent : 5, next ? next.percent : 100);
    onChange(curve.map((c, i) => (i === drag ? { temp_c, percent } : c)));
  };

  const path = [
    `M${x(T_MIN)},${y(curve[0].percent)}`,
    ...curve.map((c) => `L${x(c.temp_c)},${y(c.percent)}`),
    `L${x(T_MAX)},${y(curve.at(-1).percent)}`,
  ].join(" ");

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none"
      onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} stroke="#f1f5f9" />
          <text x={PAD.l - 6} y={y(p) + 3} textAnchor="end" className="fill-slate-400 text-[9px]">{p}%</text>
        </g>
      ))}
      {(unit === "F" ? [80, 110, 140, 170, 200] : [20, 40, 60, 80]).map((label) => (
        <text key={label} x={x(unit === "F" ? ((label - 32) * 5) / 9 : label)} y={H - 8} textAnchor="middle"
          className="fill-slate-400 text-[9px]">{label}°</text>
      ))}
      <rect x={x(failsafe)} y={PAD.t} width={x(T_MAX) - x(failsafe)} height={H - PAD.t - PAD.b} fill="#fff1f2" />
      <text x={x(failsafe) + 3} y={H - PAD.b - 4} className="fill-rose-400 text-[8px]">Dell</text>

      <path d={`${path} L${x(T_MAX)},${y(0)} L${x(T_MIN)},${y(0)} Z`} fill="#e0f2fe" opacity="0.6" />
      <path d={path} fill="none" stroke="#0ea5e9" strokeWidth="2" />

      {hottest != null && (
        <g>
          <line x1={x(hottest)} x2={x(hottest)} y1={PAD.t} y2={H - PAD.b} stroke="#f59e0b" strokeDasharray="3 3" />
          {target != null && <circle cx={x(hottest)} cy={y(target)} r="4" fill="#f59e0b" />}
        </g>
      )}

      {curve.map((c, i) => (
        <g key={i} className="cursor-grab" onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(i); }}>
          <circle cx={x(c.temp_c)} cy={y(c.percent)} r="14" fill="transparent" />
          <circle cx={x(c.temp_c)} cy={y(c.percent)} r={drag === i ? 7 : 5.5} fill="white" stroke="#0284c7" strokeWidth="2.5" />
          {drag === i && (
            <text x={x(c.temp_c)} y={y(c.percent) - 12} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
              {toUnit(c.temp_c, unit)}° · {c.percent}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
