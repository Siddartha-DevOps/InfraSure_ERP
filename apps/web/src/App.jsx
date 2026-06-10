import { useEffect, useState } from "react";
import { gql, uploadContractDocument, API_ORIGIN } from "./api.js";

// Days-until-expiry helper for the expiry-alert highlighting.
function daysUntil(iso) {
  if (!iso) return Infinity;
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

// Role → dashboard sections, mirroring the API RBAC design.
const NAV_BY_ROLE = {
  ADMIN: [
    "portfolio",
    "compliance",
    "contracts",
    "finance",
    "safety",
    "environment",
    "labour",
    "rera",
  ],
  PROJECT_MANAGER: ["portfolio", "compliance", "contracts", "finance", "rera"],
  COMPLIANCE_OFFICER: [
    "compliance",
    "contracts",
    "safety",
    "environment",
    "labour",
    "rera",
  ],
  ACCOUNTANT: ["compliance", "finance", "labour"],
  ENGINEER: ["safety", "environment", "contracts"],
};

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@demo.test");
  const [password, setPassword] = useState("Passw0rd!");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await gql(
        `mutation($email:String!,$password:String!){
          login(email:$email,password:$password){
            token user{user_id email role tenant_id} tenant{company_name}
          }
        }`,
        { email, password }
      );
      localStorage.setItem("token", data.login.token);
      onLogin(data.login);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={submit}
        className="bg-white p-8 rounded-xl shadow-md w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-slate-800">InfraSure ERP</h1>
        <p className="text-sm text-slate-500">Construction compliance platform</p>
        <input
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          className="w-full border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-slate-800 text-white rounded py-2 hover:bg-slate-700">
          Sign in
        </button>
      </form>
    </div>
  );
}

function Card({ title, children, wide }) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-5 ${wide ? "md:col-span-2" : ""}`}
    >
      <h3 className="font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// A single KPI tile; colour reflects how healthy the percentage is.
function Kpi({ label, value, suffix = "%" }) {
  const n = typeof value === "number" ? value : 0;
  const tone =
    suffix !== "%"
      ? "text-slate-800"
      : n >= 85
      ? "text-emerald-600"
      : n >= 60
      ? "text-amber-600"
      : "text-red-600";
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>
        {value}
        {suffix}
      </p>
    </div>
  );
}

const STATUS_TONE = {
  FILED: "text-emerald-600",
  APPROVED: "text-emerald-600",
  COMPLETED: "text-emerald-600",
  PENDING: "text-amber-600",
  FAILED: "text-red-600",
};
function StatusPill({ value }) {
  return (
    <span className={`font-medium ${STATUS_TONE[value] || "text-slate-600"}`}>
      {value}
    </span>
  );
}

function Dashboard({ session, onLogout }) {
  const { user, tenant } = session;
  const tabs = NAV_BY_ROLE[user.role] || [];
  const [tab, setTab] = useState(tabs[0] || "portfolio");
  const [data, setData] = useState({
    contracts: [],
    expiring: [],
    finance: [],
    safety: [],
    environment: [],
    labour: [],
    rera: [],
    kpis: null,
  });
  const [err, setErr] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    async function load() {
      setErr("");
      const t = user.tenant_id;
      const out = {
        contracts: [],
        expiring: [],
        finance: [],
        safety: [],
        environment: [],
        labour: [],
        rera: [],
        kpis: null,
      };
      const safe = (p, fb) => p.then((d) => d).catch(() => fb);

      try {
        if (tabs.includes("contracts") || tabs.includes("portfolio")) {
          const d = await safe(
            gql(
              `query($t:ID!){getContracts(tenant_id:$t){contract_id title status expiry_date document_url version}}`,
              { t }
            ),
            { getContracts: [] }
          );
          out.contracts = d.getContracts || [];
          const e = await safe(
            gql(
              `query($t:ID!){getExpiringContracts(tenant_id:$t,withinDays:30){contract_id title status expiry_date}}`,
              { t }
            ),
            { getExpiringContracts: [] }
          );
          out.expiring = e.getExpiringContracts || [];
        }
        if (tabs.includes("compliance") || tabs.includes("portfolio")) {
          const d = await safe(
            gql(
              `query($t:ID!){getComplianceKPIs(tenant_id:$t){gst_filing_compliance tds_filing_compliance ra_bill_approval_rate safety_audit_completion avg_ppe_compliance pf_esi_filing_rate rera_filing_rate overdue_payments audit_readiness_score}}`,
              { t }
            ),
            { getComplianceKPIs: null }
          );
          out.kpis = d.getComplianceKPIs;
        }
        if (tabs.includes("finance")) {
          const d = await safe(
            gql(
              `query($t:ID!){getFinanceRecords(tenant_id:$t){finance_id invoice_number amount gst_filing_status tds_status ra_bill_status due_date paid_date}}`,
              { t }
            ),
            { getFinanceRecords: [] }
          );
          out.finance = d.getFinanceRecords || [];
        }
        if (tabs.includes("safety")) {
          const d = await safe(
            gql(
              `query($t:ID!){getSafetyAudits(tenant_id:$t){safety_id site_name checklist_status ppe_compliance audit_date}}`,
              { t }
            ),
            { getSafetyAudits: [] }
          );
          out.safety = d.getSafetyAudits || [];
        }
        if (tabs.includes("environment")) {
          const d = await safe(
            gql(
              `query($t:ID!){getEnvironmentalLogs(tenant_id:$t){env_log_id log_type reading unit notes recorded_at}}`,
              { t }
            ),
            { getEnvironmentalLogs: [] }
          );
          out.environment = d.getEnvironmentalLogs || [];
        }
        if (tabs.includes("labour")) {
          const d = await safe(
            gql(
              `query($t:ID!){getLabourFilings(tenant_id:$t){labour_id filing_type period worker_count amount status filed_date}}`,
              { t }
            ),
            { getLabourFilings: [] }
          );
          out.labour = d.getLabourFilings || [];
        }
        if (tabs.includes("rera")) {
          const d = await safe(
            gql(
              `query($t:ID!){getReraFilings(tenant_id:$t){filing_id project_name filing_type status due_date filed_date}}`,
              { t }
            ),
            { getReraFilings: [] }
          );
          out.rera = d.getReraFilings || [];
        }
        setData(out);
      } catch (e) {
        setErr(e.message);
      }
    }
    load();
  }, [tab, user.tenant_id, reload]);

  const canUpload = ["ADMIN", "PROJECT_MANAGER", "COMPLIANCE_OFFICER"].includes(
    user.role
  );
  const refresh = () => setReload((n) => n + 1);

  async function handleUpload(contractId, file) {
    if (!file) return;
    setErr("");
    try {
      await uploadContractDocument(contractId, user.tenant_id, file);
      refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  // Fire a mutation then refresh the active view.
  async function mutate(query, variables) {
    setErr("");
    try {
      await gql(query, { ...variables, t: user.tenant_id });
      refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <span className="font-bold">InfraSure ERP</span>
          <span className="ml-3 text-slate-300 text-sm">{tenant.company_name}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {user.email} · <span className="text-emerald-300">{user.role}</span>
          </span>
          <button onClick={onLogout} className="underline">
            Logout
          </button>
        </div>
      </header>

      <nav className="bg-white border-b px-6 flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm capitalize border-b-2 ${
              tab === t
                ? "border-slate-800 text-slate-800 font-medium"
                : "border-transparent text-slate-500"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="p-6 grid gap-5 md:grid-cols-2">
        {err && <p className="text-red-600 col-span-2">{err}</p>}

        {tab === "portfolio" && (
          <>
            <Card title="Active Contracts">
              <p className="text-4xl font-bold text-slate-800">
                {data.contracts.length}
              </p>
            </Card>
            <Card title="Audit Readiness">
              <p className="text-4xl font-bold text-emerald-600">
                {data.kpis ? `${data.kpis.audit_readiness_score}%` : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Composite of all compliance KPIs
              </p>
            </Card>
            <Card title="Expiry Alerts (next 30 days)">
              {data.expiring.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No contracts expiring soon. ✅
                </p>
              ) : (
                <ul className="text-sm space-y-1">
                  {data.expiring.map((c) => {
                    const d = daysUntil(c.expiry_date);
                    return (
                      <li key={c.contract_id} className="flex justify-between">
                        <span className="text-slate-700">{c.title}</span>
                        <span
                          className={
                            d < 0
                              ? "text-red-600 font-medium"
                              : "text-amber-600 font-medium"
                          }
                        >
                          {d < 0 ? `expired ${-d}d ago` : `in ${d}d`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        )}

        {tab === "compliance" && (
          <Card title="Compliance KPIs" wide>
            {!data.kpis ? (
              <p className="text-sm text-slate-500">No KPI data.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="GST filing" value={data.kpis.gst_filing_compliance} />
                <Kpi label="TDS filing" value={data.kpis.tds_filing_compliance} />
                <Kpi label="RA bill approval" value={data.kpis.ra_bill_approval_rate} />
                <Kpi label="Safety audits done" value={data.kpis.safety_audit_completion} />
                <Kpi label="Avg PPE compliance" value={data.kpis.avg_ppe_compliance} />
                <Kpi label="PF/ESI filing" value={data.kpis.pf_esi_filing_rate} />
                <Kpi label="RERA filing" value={data.kpis.rera_filing_rate} />
                <Kpi label="Overdue payments" value={data.kpis.overdue_payments} suffix="" />
                <Kpi label="Audit readiness" value={data.kpis.audit_readiness_score} />
              </div>
            )}
          </Card>
        )}

        {tab === "contracts" && (
          <Card title="Contracts" wide>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Title</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody>
                {data.contracts.map((c) => {
                  const d = daysUntil(c.expiry_date);
                  const soon = d <= 30;
                  return (
                    <tr key={c.contract_id} className="border-t align-middle">
                      <td className="py-2">{c.title}</td>
                      <td>{c.status}</td>
                      <td className={soon ? "text-amber-600 font-medium" : ""}>
                        {(c.expiry_date || "").slice(0, 10)}
                        {soon && (
                          <span className="ml-1 text-xs">
                            {d < 0 ? "(expired)" : `(${d}d)`}
                          </span>
                        )}
                      </td>
                      <td>
                        {c.document_url ? (
                          <a
                            href={`${API_ORIGIN}${c.document_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            view
                          </a>
                        ) : canUpload ? (
                          <label className="text-slate-500 cursor-pointer underline">
                            upload
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) =>
                                handleUpload(c.contract_id, e.target.files[0])
                              }
                            />
                          </label>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "finance" && (
          <Card title="Financial Compliance" wide>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Invoice</th>
                  <th>Amount</th>
                  <th>GST</th>
                  <th>TDS</th>
                  <th>RA Bill</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {data.finance.map((f) => {
                  const overdue =
                    !f.paid_date && daysUntil(f.due_date) < 0;
                  return (
                    <tr key={f.finance_id} className="border-t">
                      <td className="py-2">{f.invoice_number || "—"}</td>
                      <td>₹{f.amount.toLocaleString("en-IN")}</td>
                      <td><StatusPill value={f.gst_filing_status} /></td>
                      <td><StatusPill value={f.tds_status} /></td>
                      <td><StatusPill value={f.ra_bill_status} /></td>
                      <td>
                        {f.paid_date ? (
                          <span className="text-emerald-600">paid</span>
                        ) : overdue ? (
                          <span className="text-red-600 font-medium">overdue</span>
                        ) : (
                          <span className="text-amber-600">due</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "safety" && (
          <Card title="Safety Audits" wide>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Site</th>
                  <th>Audit date</th>
                  <th>Status</th>
                  <th>PPE %</th>
                </tr>
              </thead>
              <tbody>
                {data.safety.map((s) => (
                  <tr key={s.safety_id} className="border-t">
                    <td className="py-2">{s.site_name || "—"}</td>
                    <td>{(s.audit_date || "").slice(0, 10)}</td>
                    <td><StatusPill value={s.checklist_status} /></td>
                    <td
                      className={
                        s.ppe_compliance >= 85
                          ? "text-emerald-600"
                          : s.ppe_compliance >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                      }
                    >
                      {s.ppe_compliance}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "environment" && (
          <Card title="Environmental Logs (pollution / waste)" wide>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Type</th>
                  <th>Reading</th>
                  <th>Recorded</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.environment.map((e) => (
                  <tr key={e.env_log_id} className="border-t">
                    <td className="py-2">{e.log_type}</td>
                    <td>
                      {e.reading} {e.unit}
                    </td>
                    <td>{(e.recorded_at || "").slice(0, 10)}</td>
                    <td className="text-slate-500">{e.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "labour" && (
          <Card title="Labour Compliance (PF / ESI / Wage)" wide>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Type</th>
                  <th>Period</th>
                  <th>Workers</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {canUpload && <th></th>}
                </tr>
              </thead>
              <tbody>
                {data.labour.map((l) => (
                  <tr key={l.labour_id} className="border-t">
                    <td className="py-2">{l.filing_type}</td>
                    <td>{l.period}</td>
                    <td>{l.worker_count}</td>
                    <td>₹{l.amount.toLocaleString("en-IN")}</td>
                    <td><StatusPill value={l.status} /></td>
                    {canUpload && (
                      <td>
                        {l.status !== "FILED" && (
                          <button
                            onClick={() =>
                              mutate(
                                `mutation($t:ID!,$id:ID!){updateLabourFilingStatus(tenant_id:$t,labour_id:$id,status:"FILED"){labour_id}}`,
                                { id: l.labour_id }
                              )
                            }
                            className="text-blue-600 underline text-xs"
                          >
                            mark filed
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "rera" && (
          <Card title="RERA Filings" wide>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Project</th>
                  <th>Type</th>
                  <th>Due</th>
                  <th>Status</th>
                  {canUpload && <th></th>}
                </tr>
              </thead>
              <tbody>
                {data.rera.map((r) => {
                  const overdue =
                    r.status === "PENDING" && daysUntil(r.due_date) < 0;
                  return (
                    <tr key={r.filing_id} className="border-t">
                      <td className="py-2">{r.project_name}</td>
                      <td>{r.filing_type}</td>
                      <td className={overdue ? "text-red-600 font-medium" : ""}>
                        {(r.due_date || "").slice(0, 10)}
                      </td>
                      <td><StatusPill value={r.status} /></td>
                      {canUpload && (
                        <td>
                          {r.status === "PENDING" && (
                            <button
                              onClick={() =>
                                mutate(
                                  `mutation($t:ID!,$id:ID!){updateReraFilingStatus(tenant_id:$t,filing_id:$id,status:"FILED"){filing_id}}`,
                                  { id: r.filing_id }
                                )
                              }
                              className="text-blue-600 underline text-xs"
                            >
                              mark filed
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  if (!session) return <Login onLogin={setSession} />;
  return (
    <Dashboard
      session={session}
      onLogout={() => {
        localStorage.removeItem("token");
        setSession(null);
      }}
    />
  );
}
