import { useEffect, useState } from "react";
import { gql, uploadContractDocument, API_ORIGIN } from "./api.js";

// Days-until-expiry helper for the expiry-alert highlighting.
function daysUntil(iso) {
  if (!iso) return Infinity;
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

// Role → dashboard sections, mirroring the API RBAC design.
const NAV_BY_ROLE = {
  ADMIN: ["portfolio", "contracts", "finance", "safety"],
  PROJECT_MANAGER: ["portfolio", "contracts"],
  COMPLIANCE_OFFICER: ["contracts", "safety"],
  ACCOUNTANT: ["finance"],
  ENGINEER: ["safety", "contracts"],
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

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
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
  });
  const [err, setErr] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    async function load() {
      setErr("");
      try {
        const t = user.tenant_id;
        const out = { contracts: [], expiring: [], finance: [], safety: [] };
        if (tabs.includes("contracts") || tabs.includes("portfolio")) {
          const d = await gql(
            `query($t:ID!){getContracts(tenant_id:$t){contract_id title status expiry_date document_url version}}`,
            { t }
          ).catch(() => ({ getContracts: [] }));
          out.contracts = d.getContracts || [];
          const e = await gql(
            `query($t:ID!){getExpiringContracts(tenant_id:$t,withinDays:30){contract_id title status expiry_date}}`,
            { t }
          ).catch(() => ({ getExpiringContracts: [] }));
          out.expiring = e.getExpiringContracts || [];
        }
        if (tabs.includes("finance")) {
          const d = await gql(
            `query($t:ID!){getFinanceRecords(tenant_id:$t){finance_id amount gst_filing_status ra_bill_status due_date}}`,
            { t }
          ).catch(() => ({ getFinanceRecords: [] }));
          out.finance = d.getFinanceRecords || [];
        }
        if (tabs.includes("safety")) {
          const d = await gql(
            `query($t:ID!){getSafetyAudits(tenant_id:$t){safety_id checklist_status audit_date}}`,
            { t }
          ).catch(() => ({ getSafetyAudits: [] }));
          out.safety = d.getSafetyAudits || [];
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

  async function handleUpload(contractId, file) {
    if (!file) return;
    setErr("");
    try {
      await uploadContractDocument(contractId, user.tenant_id, file);
      setReload((n) => n + 1);
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

      <nav className="bg-white border-b px-6 flex gap-2">
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
            <Card title="Compliance Snapshot">
              <ul className="text-sm text-slate-600 space-y-1">
                <li>Contracts tracked: {data.contracts.length}</li>
                <li>Role view: {user.role}</li>
              </ul>
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

        {tab === "contracts" && (
          <Card title="Contracts">
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
          <Card title="Finance Records">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Amount</th>
                  <th>GST</th>
                  <th>RA Bill</th>
                </tr>
              </thead>
              <tbody>
                {data.finance.map((f) => (
                  <tr key={f.finance_id} className="border-t">
                    <td className="py-2">₹{f.amount}</td>
                    <td>{f.gst_filing_status}</td>
                    <td>{f.ra_bill_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "safety" && (
          <Card title="Safety Audits">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1">Audit date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.safety.map((s) => (
                  <tr key={s.safety_id} className="border-t">
                    <td className="py-2">{(s.audit_date || "").slice(0, 10)}</td>
                    <td>{s.checklist_status}</td>
                  </tr>
                ))}
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
