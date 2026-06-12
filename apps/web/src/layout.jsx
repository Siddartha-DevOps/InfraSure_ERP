// App shell: left sidebar (modules + quick actions) and top bar (alerts, profile).
import { useState } from "react";
import { AlertsFeed } from "./ui.jsx";
import { GlobalSearch } from "./widgets.jsx";
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
};

export function Sidebar({ tabs, tab, setTab, quickActions }) {
  const { t: tr } = useI18n();
  return (
    <aside
      className="w-60 shrink-0 bg-primary text-white min-h-screen flex flex-col"
      aria-label="Module navigation"
    >
      <div className="px-5 py-5 border-b border-white/10">
        <p className="font-bold text-lg leading-tight">InfraSure ERP</p>
        <p className="text-xs text-white/60">{tr("app.tagline")}</p>
      </div>

      <nav className="flex-1 py-3" aria-label="Modules">
        {tabs.map((t) => {
          const m = { label: tr(`nav.${t}`), icon: MODULE_ICON[t] || "▫️" };
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={active ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                active
                  ? "bg-white/15 font-semibold border-l-4 border-success pl-4"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              <span aria-hidden="true">{m.icon}</span>
              {m.label}
            </button>
          );
        })}
      </nav>

      {quickActions?.length > 0 && (
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs uppercase tracking-wide text-white/50 mb-2">
            {tr("qa.title")}
          </p>
          <div className="space-y-2">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={qa.onClick}
                className="w-full bg-success text-white rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                + {qa.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function TopBar({ user, tenant, alerts, onLogout, searchIndex = [], onSearchPick }) {
  const [open, setOpen] = useState(false);
  const { t: tr, lang, setLang } = useI18n();
  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 sticky top-0 z-40">
      <div className="hidden sm:block shrink-0">
        <p className="font-semibold text-gray-800 leading-tight">{tenant.company_name}</p>
        <p className="text-xs text-neutral">{tr("top.workspace")}</p>
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
