// App shell: left sidebar (modules + quick actions) and top bar (alerts, profile).
import { useState } from "react";
import { AlertsFeed } from "./ui.jsx";
import { GlobalSearch, AuditFeed } from "./widgets.jsx";
import { useI18n, LANGUAGES } from "./i18n.jsx";

const MODULE_ICON = {
  home: "🏠",
  compliance: "📊",
  audit: "🗂️",
  ai: "🤖",
  contracts: "📃",
  finance: "💰",
  safety: "🦺",
  environment: "🌿",
  labour: "👷",
  rera: "🏛️",
  vendors: "🤝",
  disputes: "⚖️",
  billing: "💳",
  integrations: "🔌",
  map: "🗺️",
  reports: "📈",
  approvals: "🗳️",
};

// Quick-actions dropdown for the top tab bar (replaces the sidebar's action list).
function QuickActionsMenu({ quickActions }) {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0 pl-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="bg-success text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary whitespace-nowrap"
      >
        ＋ {tr("qa.title")}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50"
        >
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              role="menuitem"
              onClick={() => {
                qa.onClick();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-800 rounded-lg hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              + {qa.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Primary navigation: a horizontal tab bar under the header (replaces the sidebar).
export function TopTabs({ tabs, tab, setTab, quickActions }) {
  const { t: tr } = useI18n();
  return (
    <nav className="bg-white border-b border-gray-200" aria-label="Modules">
      <div className="flex items-center px-2 md:px-4">
        <div className="flex-1 flex items-center gap-0.5 overflow-x-auto" role="tablist">
          {tabs.map((t) => {
            const m = { label: tr(`nav.${t}`), icon: MODULE_ICON[t] || "▫️" };
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-neutral hover:text-gray-800 hover:border-gray-300"
                }`}
              >
                <span aria-hidden="true">{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
        {quickActions?.length > 0 && <QuickActionsMenu quickActions={quickActions} />}
      </div>
    </nav>
  );
}

export function TopBar({ user, tenant, alerts, onLogout, searchIndex = [], onSearchPick, auditFeed = [] }) {
  const [open, setOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const { t: tr, lang, setLang } = useI18n();
  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3">
      <div className="shrink-0 flex items-center gap-3">
        <p className="font-bold text-primary text-lg leading-none hidden sm:block">InfraSure</p>
        <div className="hidden md:block border-l border-gray-200 pl-3">
          <p className="font-semibold text-gray-800 leading-tight">{tenant.company_name}</p>
          <p className="text-xs text-neutral">{tr("top.workspace")}</p>
        </div>
      </div>

      <div className="flex-1 flex justify-center px-2">
        {searchIndex.length > 0 && (
          <GlobalSearch index={searchIndex} onPick={onSearchPick} />
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-4 shrink-0">
        <label className="sr-only" htmlFor="lang-select">
          Language
        </label>
        <select
          id="lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        {auditFeed.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setAuditOpen((o) => !o)}
              aria-label={tr("audit.logs")}
              aria-expanded={auditOpen}
              className="text-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1"
            >
              📋
            </button>
            {auditOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
                <h4 className="font-semibold text-gray-800 mb-3">{tr("audit.logs")}</h4>
                <AuditFeed entries={auditFeed} />
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={`Alerts: ${alerts.length} active, ${critical} critical`}
            aria-expanded={open}
            className="relative text-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1"
          >
            🔔
            {alerts.length > 0 && (
              <span
                className={`absolute -top-0.5 -right-0.5 text-[10px] font-bold text-white rounded-full w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center ${
                  critical > 0 ? "bg-danger" : "bg-warning"
                }`}
              >
                {alerts.length}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
              <h4 className="font-semibold text-gray-800 mb-3">{tr("top.alerts")}</h4>
              <AlertsFeed alerts={alerts} compact />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold"
            aria-hidden="true"
          >
            {user.email[0].toUpperCase()}
          </span>
          <div className="text-sm leading-tight">
            <p className="text-gray-800">{user.email}</p>
            <p className="text-xs text-success font-medium">
              {user.role.replace("_", " ")}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="text-sm text-neutral hover:text-gray-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {tr("top.logout")}
        </button>
      </div>
    </header>
  );
}
