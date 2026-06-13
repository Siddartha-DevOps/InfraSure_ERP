// InfraSure ERP component library.
// Design tokens (tailwind.config.js): primary #1E3A8A · success #10B981 ·
// warning #F59E0B · danger #DC2626 · neutral #6B7280 · surface #F3F4F6.
// Statuses always pair an icon/text with the color (WCAG: never color-only);
// *-text color variants keep small text at AA contrast.
import { useEffect, useRef } from "react";
import { useI18n } from "./i18n.jsx";

export function Card({ title, children, wide, action }) {
  return (
    <section
      className={`bg-white rounded-xl shadow-sm p-5 ${wide ? "md:col-span-2" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg text-gray-800">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// KPI card: large semi-bold number + optional trend arrow per the design spec.
export function Kpi({ label, value, suffix = "%", trend, invert = false }) {
  const n = typeof value === "number" ? value : 0;
  const tone =
    suffix !== "%"
      ? invert && n > 0
        ? "text-danger-text"
        : "text-gray-800"
      : n >= 85
      ? "text-success-text"
      : n >= 60
      ? "text-warning-text"
      : "text-danger-text";
  return (
    <div className="bg-surface rounded-lg p-4">
      <p className="text-xs text-neutral">{label}</p>
      <p className={`text-2xl font-semibold ${tone}`}>
        {value}
        {suffix}
        {typeof trend === "number" && trend !== 0 && (
          <span
            className={`ml-2 text-sm align-middle ${
              trend > 0 ? "text-success-text" : "text-danger-text"
            }`}
            aria-label={trend > 0 ? "trending up" : "trending down"}
          >
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}
          </span>
        )}
      </p>
    </div>
  );
}

const STATUS_STYLE = {
  FILED: { tone: "text-success-text bg-success-soft", icon: "✓" },
  APPROVED: { tone: "text-success-text bg-success-soft", icon: "✓" },
  COMPLETED: { tone: "text-success-text bg-success-soft", icon: "✓" },
  ACTIVE: { tone: "text-success-text bg-success-soft", icon: "✓" },
  RESOLVED: { tone: "text-success-text bg-success-soft", icon: "✓" },
  PAID: { tone: "text-success-text bg-success-soft", icon: "✓" },
  PENDING: { tone: "text-warning-text bg-warning-soft", icon: "•" },
  OPEN: { tone: "text-warning-text bg-warning-soft", icon: "•" },
  INVESTIGATING: { tone: "text-warning-text bg-warning-soft", icon: "•" },
  CLOSED: { tone: "text-neutral bg-surface", icon: "✓" },
  DUE: { tone: "text-warning-text bg-warning-soft", icon: "•" },
  IN_ARBITRATION: { tone: "text-warning-text bg-warning-soft", icon: "•" },
  DRAFT: { tone: "text-neutral bg-surface", icon: "•" },
  FAILED: { tone: "text-danger-text bg-danger-soft", icon: "✗" },
  ESCALATED: { tone: "text-danger-text bg-danger-soft", icon: "!" },
  OVERDUE: { tone: "text-danger-text bg-danger-soft", icon: "!" },
  SUSPENDED: { tone: "text-danger-text bg-danger-soft", icon: "✗" },
};

export function StatusPill({ value }) {
  const { t } = useI18n();
  const s = STATUS_STYLE[value] || { tone: "text-neutral bg-surface", icon: "•" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.tone}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {t(`status.${value}`)}
    </span>
  );
}

// ---- Charts: dependency-free SVG (line = trends, bar = comparisons). ----

export function BarChart({ data, color = "#1E3A8A", height = 120 }) {
  if (!data?.length) return <p className="text-sm text-neutral">No data.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length;
  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height / 2}`}
        className="w-full"
        role="img"
        aria-label="bar chart"
      >
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 2 - 14);
          return (
            <g key={i}>
              <rect
                x={i * barW + barW * 0.15}
                y={height / 2 - h - 12}
                width={barW * 0.7}
                height={h}
                rx="1"
                fill={color}
              />
              <text
                x={i * barW + barW / 2}
                y={height / 2 - 2}
                textAnchor="middle"
                fontSize="4"
                fill="#6B7280"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-neutral mt-1">
        <span>max {max}</span>
      </div>
    </div>
  );
}

export function LineChart({ data, color = "#10B981", height = 120 }) {
  if (!data?.length) return <p className="text-sm text-neutral">No data.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = 100 / Math.max(data.length - 1, 1);
  const pts = data
    .map(
      (d, i) =>
        `${i * stepX},${height / 2 - 12 - (d.value / max) * (height / 2 - 20)}`
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 100 ${height / 2}`}
      className="w-full"
      role="img"
      aria-label="line chart"
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      {data.map((d, i) => (
        <text
          key={i}
          x={i * stepX}
          y={height / 2 - 2}
          textAnchor="middle"
          fontSize="4"
          fill="#6B7280"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ---- Modal (approvals, uploads, forms) ----

export function Modal({ open, title, onClose, children }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-neutral hover:text-gray-800 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Form field with label + inline validation error.
export function Field({ label, error, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
      {error && (
        <span className="block text-xs text-danger-text mt-1" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function Button({ children, variant = "primary", ...props }) {
  const styles = {
    primary: "bg-primary text-white hover:bg-primary-light",
    secondary: "bg-surface text-gray-700 hover:bg-gray-200 border border-gray-300",
    danger: "bg-danger text-white hover:bg-red-700",
  };
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 ${styles[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ---- Alerts feed (severity-coded) ----

const SEVERITY_STYLE = {
  critical: { dot: "bg-danger", key: "sev.critical", text: "text-danger-text" },
  warning: { dot: "bg-warning", key: "sev.warning", text: "text-warning-text" },
  ok: { dot: "bg-success", key: "sev.ok", text: "text-success-text" },
};

export function AlertsFeed({ alerts, compact = false }) {
  const { t } = useI18n();
  if (!alerts?.length)
    return (
      <p className="text-sm text-success-text flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-success" aria-hidden="true" />
        {t("alerts.allclear")}
      </p>
    );
  return (
    <ul className={`space-y-2 ${compact ? "max-h-72 overflow-y-auto" : ""}`}>
      {alerts.map((a, i) => {
        const s = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.warning;
        return (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`}
              aria-hidden="true"
            />
            <div>
              <span className={`font-medium mr-1 ${s.text}`}>{t(s.key)}:</span>
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
        );
      })}
    </ul>
  );
}

// ---- Site status board (map placeholder until geo-tagged projects exist) ----

const SITE_TONE = {
  COMPLETED: "bg-success-soft text-success-text",
  PENDING: "bg-warning-soft text-warning-text",
  FAILED: "bg-danger-soft text-danger-text",
};

export function SiteBoard({ safety }) {
  const { t } = useI18n();
  // Latest status per site from safety audits.
  const bySite = new Map();
  for (const s of safety || []) {
    const key = s.site_name || "Unassigned site";
    if (!bySite.has(key)) bySite.set(key, s.checklist_status);
  }
  if (bySite.size === 0)
    return <p className="text-sm text-neutral">No site data yet.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[...bySite].map(([site, status]) => (
          <span
            key={site}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              SITE_TONE[status] || "bg-surface text-neutral"
            }`}
          >
            <span className="text-xs" aria-hidden="true">
              {status === "COMPLETED" ? "🟢" : status === "FAILED" ? "🔴" : "🟡"}
            </span>
            {site} · {t(`status.${status}`)}
          </span>
        ))}
      </div>
      <p className="text-xs text-neutral mt-2">{t("misc.geoNote")}</p>
    </div>
  );
}
