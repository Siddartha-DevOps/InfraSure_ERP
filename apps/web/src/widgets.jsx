// Shared dashboard widget library (extends ui.jsx; no new dependencies).
// Production patterns: loading / empty / error states, score gauges, donut charts,
// filterable data tables, audit feed, notifications, calendar, tasks, global search.
import { useMemo, useState } from "react";
import { Card } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const day = (iso) => (iso || "").slice(0, 10);

// ---------- State widgets ----------

export function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded w-full" />
      ))}
    </div>
  );
}

export function KpiSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface rounded-lg p-4 animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
          <div className="h-6 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = "📭", title, hint }) {
  return (
    <div className="text-center py-8">
      <div className="text-3xl mb-2" aria-hidden="true">{icon}</div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="text-xs text-neutral mt-1">{hint}</p>}
    </div>
  );
}

// Standardizes the loading → error → empty → content lifecycle for a card body.
export function Section({ loading, error, empty, onRetry, skeleton, children }) {
  if (loading) return skeleton || <LoadingSkeleton />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (empty) return empty;
  return children;
}

export function ErrorState({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="text-center py-8" role="alert">
      <div className="text-3xl mb-2" aria-hidden="true">⚠️</div>
      <p className="text-sm font-medium text-danger-text">
        {message || t("state.error")}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs text-primary underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {t("state.retry")}
        </button>
      )}
    </div>
  );
}

// ---------- Score widgets (Compliance / Risk / Project Health) ----------

// Circular SVG gauge, 0-100. `invert` => higher value is worse (risk).
export function ScoreGauge({ label, value = 0, invert = false, size = 104 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  const good = invert ? v < 40 : v >= 85;
  const mid = invert ? v < 70 : v >= 60;
  const color = good ? "#047857" : mid ? "#B45309" : "#B91C1C";
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${label}: ${v}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E5E7EB" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1f2937">
          {Math.round(v)}
        </text>
      </svg>
      <p className="text-xs text-neutral mt-1 text-center">{label}</p>
    </div>
  );
}

// ---------- Charts ----------

export function DonutChart({ data = [], size = 120 }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) return <EmptyState icon="📊" title="No data" />;
  let acc = 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="distribution">
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = `${frac * c} ${c}`;
          const seg = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-acc * c}
              transform="rotate(-90 50 50)"
            />
          );
          acc += frac;
          return seg;
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="16" fontWeight="700" fill="#1f2937">
          {total}
        </text>
      </svg>
      <ul className="text-xs space-y-1">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} aria-hidden="true" />
            <span className="text-gray-700">{d.label}</span>
            <span className="text-neutral">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Filterable data table ----------

export function DataTable({ columns, rows, filterable = true, empty }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      columns.some((col) => String(col.value(r) ?? "").toLowerCase().includes(needle))
    );
  }, [q, rows, columns]);

  return (
    <div>
      {filterable && rows.length > 0 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("filter.placeholder")}
          aria-label={t("filter.placeholder")}
          className="mb-3 w-full md:w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}
      {filtered.length === 0 ? (
        empty || <EmptyState icon="🔍" title={t("filter.noMatches")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-neutral">
                {columns.map((col) => (
                  <th key={col.key} scope="col" className="py-1 font-medium whitespace-nowrap">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-gray-100">
                  {columns.map((col) => (
                    <td key={col.key} className="py-2 pr-3">
                      {col.render ? col.render(r) : col.value(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Audit feed ----------

export function AuditFeed({ entries = [], showTenant = false }) {
  const { t } = useI18n();
  if (entries.length === 0)
    return <EmptyState icon="🧾" title={t("audit.empty")} />;
  return (
    <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
      {entries.map((e, i) => (
        <li key={i} className="flex items-start gap-2 border-b border-gray-50 pb-2">
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-medium text-gray-800">{e.action}</span>
            {showTenant && e.tenant_id && (
              <span className="text-xs text-neutral ml-1">· {e.tenant_id.slice(0, 8)}</span>
            )}
            <p className="text-xs text-neutral">{day(e.timestamp)} {(e.timestamp || "").slice(11, 16)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Notifications center (severity-grouped) ----------

export function NotificationsCenter({ alerts = [] }) {
  const { t } = useI18n();
  if (alerts.length === 0)
    return <p className="text-sm text-success-text">{t("alerts.allclear")}</p>;
  const groups = { critical: [], warning: [] };
  alerts.forEach((a) => (groups[a.severity] || groups.warning).push(a));
  return (
    <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
      {alerts.map((a, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
              a.severity === "critical" ? "bg-danger" : "bg-warning"
            }`}
            aria-hidden="true"
          />
          <div>
            <span className="text-gray-700">{a.text}</span>
            <span className="text-neutral text-xs ml-1">· {a.module}</span>
            {a.onAction && (
              <button
                onClick={a.onAction}
                className="ml-2 text-xs text-primary underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {a.actionLabel}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Mini calendar (due-date markers) ----------

export function MiniCalendar({ events = [] }) {
  const { t } = useI18n();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const byDay = {};
  events.forEach((e) => {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month)
      (byDay[d.getDate()] ||= []).push(e);
  });
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">
        {today.toLocaleString("en", { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-neutral">{d}</div>
        ))}
        {Array.from({ length: first }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const date = i + 1;
          const ev = byDay[date];
          const isToday = date === today.getDate();
          const sev = ev?.some((e) => e.severity === "critical")
            ? "bg-danger text-white"
            : ev
            ? "bg-warning text-white"
            : isToday
            ? "ring-1 ring-primary text-primary"
            : "text-gray-600";
          return (
            <div
              key={date}
              title={ev?.map((e) => e.label).join(", ")}
              className={`rounded py-1 ${sev}`}
            >
              {date}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-neutral mt-2">{t("calendar.hint")}</p>
    </div>
  );
}

// ---------- Tasks ----------

export function TasksWidget({ tasks = [], onAct, actLabel }) {
  const { t } = useI18n();
  if (tasks.length === 0)
    return <EmptyState icon="✅" title={t("tasks.empty")} />;
  return (
    <ul className="space-y-2 text-sm">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-2">
          <span className="text-gray-700 truncate">{task.label}</span>
          {onAct && actLabel ? (
            <button
              onClick={() => onAct(task)}
              className="text-primary underline text-xs shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {actLabel}
            </button>
          ) : (
            <span className="text-xs text-warning-text shrink-0">{task.meta}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------- Global search (client-side over loaded datasets) ----------

export function GlobalSearch({ index = [], onPick }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const needle = q.toLowerCase();
    return index
      .filter((it) => it.label.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, index]);

  return (
    <div className="relative w-full max-w-md">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral text-sm" aria-hidden="true">
        🔍
      </span>
      {results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {results.map((it, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  onPick?.(it);
                  setQ("");
                }}
                className="w-full text-left px-3 py-2 hover:bg-surface text-sm flex items-center gap-2"
              >
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary-soft text-primary">
                  {it.type}
                </span>
                <span className="text-gray-700 truncate">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
