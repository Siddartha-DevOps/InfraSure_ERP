import { useEffect, useMemo, useState } from "react";
import { gql, uploadContractDocument } from "./api.js";
import { Sidebar, TopBar } from "./layout.jsx";
import { buildAlerts } from "./alerts.js";
import { Button, inputCls } from "./ui.jsx";
import { ProjectMap } from "./ProjectMap.jsx";
import { useI18n } from "./i18n.jsx";
import {
  EngineerHome,
  AccountantHome,
  OfficerHome,
  PMHome,
} from "./dashboards.jsx";
import {
  ComplianceModule,
  AuditModule,
  AIModule,
  ContractsModule,
  SafetyModule,
  EnvironmentModule,
  LabourModule,
  ReraModule,
  VendorsModule,
  DisputesModule,
  BillingModule,
  IntegrationsModule,
} from "./modules.jsx";
import {
  NewDPRModal,
  SafetyAuditModal,
  FinanceModal,
  ContractModal,
} from "./forms.jsx";

// Role → sidebar modules ("home" is the role-specific dashboard).
const NAV_BY_ROLE = {
  ADMIN: [
    "home",
    "compliance",
    "audit",
    "ai",
    "contracts",
    "finance",
    "safety",
    "environment",
    "labour",
    "rera",
    "vendors",
    "disputes",
    "map",
    "billing",
    "integrations",
  ],
  PROJECT_MANAGER: [
    "home",
    "compliance",
    "audit",
    "ai",
    "contracts",
    "finance",
    "rera",
    "vendors",
    "disputes",
    "map",
  ],
  COMPLIANCE_OFFICER: [
    "home",
    "compliance",
    "audit",
    "ai",
    "contracts",
    "safety",
    "environment",
    "labour",
    "rera",
    "vendors",
    "disputes",
    "map",
  ],
  ACCOUNTANT: ["home", "compliance", "audit", "ai", "finance", "labour"],
  ENGINEER: ["home", "safety", "environment", "contracts", "ai", "map"],
};

// Datasets each role's screens need (fetched once per reload).
const DATASETS_BY_ROLE = {
  ADMIN: "all",
  PROJECT_MANAGER: [
    "contracts",
    "expiring",
    "finance",
    "safety",
    "rera",
    "vendors",
    "disputes",
    "kpis",
    "audit",
    "ai",
    "dprs",
    "steps",
    "labour",
    "sites",
  ],
  COMPLIANCE_OFFICER: [
    "contracts",
    "expiring",
    "safety",
    "environment",
    "labour",
    "rera",
    "vendors",
    "disputes",
    "kpis",
    "audit",
    "ai",
    "steps",
    "sites",
  ],
  ACCOUNTANT: ["finance", "labour", "kpis", "audit", "ai"],
  ENGINEER: [
    "contracts",
    "expiring",
    "safety",
    "environment",
    "kpis",
    "ai",
    "dprs",
    "steps",
    "sites",
  ],
};

const QUERIES = {
  contracts: `query($t:ID!){getContracts(tenant_id:$t){contract_id title status expiry_date document_url version}}`,
  expiring: `query($t:ID!){getExpiringContracts(tenant_id:$t,withinDays:30){contract_id title status expiry_date}}`,
  finance: `query($t:ID!){getFinanceRecords(tenant_id:$t){finance_id invoice_number amount gst_filing_status tds_status ra_bill_status due_date paid_date}}`,
  safety: `query($t:ID!){getSafetyAudits(tenant_id:$t){safety_id site_name checklist_status ppe_compliance audit_date}}`,
  environment: `query($t:ID!){getEnvironmentalLogs(tenant_id:$t){env_log_id log_type reading unit notes recorded_at}}`,
  labour: `query($t:ID!){getLabourFilings(tenant_id:$t){labour_id filing_type period worker_count amount status filed_date}}`,
  rera: `query($t:ID!){getReraFilings(tenant_id:$t){filing_id project_name filing_type status due_date filed_date}}`,
  vendors: `query($t:ID!){getVendors(tenant_id:$t){vendor_id name gst_number certification_name certification_expiry status}}`,
  disputes: `query($t:ID!){getDisputes(tenant_id:$t){dispute_id title dispute_type counterparty amount status escalation_level}}`,
  kpis: `query($t:ID!){getComplianceKPIs(tenant_id:$t){gst_filing_compliance tds_filing_compliance ra_bill_approval_rate safety_audit_completion avg_ppe_compliance pf_esi_filing_rate rera_filing_rate overdue_payments audit_readiness_score}}`,
  audit: `query($t:ID!){getAuditReadiness(tenant_id:$t){documents_verified documents_total pending_approvals open_disputes vendor_compliance_rate audit_readiness_score}}`,
  ai: `query($t:ID!){getAIInsights(tenant_id:$t){available predictive_score risk_level weak_factors anomalies{finance_id type severity detail}}}`,
  dprs: `query($t:ID!){getDPRs(tenant_id:$t){dpr_id report_data created_at}}`,
  steps: `query($t:ID!){getWorkflowSteps(tenant_id:$t){step_id name status}}`,
  sites: `query($t:ID!){getSites(tenant_id:$t){site_id name latitude longitude status}}`,
  integrations: `query($t:ID!){getIntegrationStatus(tenant_id:$t){integration configured driver}}`,
  subscription: `query($t:ID!){getSubscription(tenant_id:$t){plan_type billing_cycle status current_period_end}}`,
  tiers: `query{getBillingTiers{code name price_inr features}}`,
};

const FIELD_OF = {
  contracts: "getContracts",
  expiring: "getExpiringContracts",
  finance: "getFinanceRecords",
  safety: "getSafetyAudits",
  environment: "getEnvironmentalLogs",
  labour: "getLabourFilings",
  rera: "getReraFilings",
  vendors: "getVendors",
  disputes: "getDisputes",
  kpis: "getComplianceKPIs",
  audit: "getAuditReadiness",
  ai: "getAIInsights",
  dprs: "getDPRs",
  steps: "getWorkflowSteps",
  sites: "getSites",
  integrations: "getIntegrationStatus",
  subscription: "getSubscription",
  tiers: "getBillingTiers",
};

const EMPTY = {
  contracts: [],
  expiring: [],
  finance: [],
  safety: [],
  environment: [],
  labour: [],
  rera: [],
  vendors: [],
  disputes: [],
  dprs: [],
  steps: [],
  sites: [],
  integrations: [],
  tiers: [],
  kpis: null,
  audit: null,
  ai: null,
  subscription: null,
};

function Login({ onLogin }) {
  const { t } = useI18n();
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
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <form
        onSubmit={submit}
        className="bg-white p-8 rounded-xl shadow-md w-96 space-y-4"
        aria-label="Sign in"
      >
        <div>
          <h1 className="text-2xl font-bold text-primary">{t("auth.title")}</h1>
          <p className="text-sm text-neutral">{t("auth.subtitle")}</p>
        </div>
        <input
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.email")}
          aria-label={t("auth.email")}
        />
        <input
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.password")}
          aria-label={t("auth.password")}
        />
        {error && (
          <p className="text-danger text-sm" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" style={{ width: "100%" }}>
          {t("auth.signin")}
        </Button>
      </form>
    </div>
  );
}

function Dashboard({ session, onLogout }) {
  const { t: tr } = useI18n();
  const { user, tenant } = session;
  const tabs = NAV_BY_ROLE[user.role] || ["home"];
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [reload, setReload] = useState(0);
  const [modal, setModal] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [integrationMsg, setIntegrationMsg] = useState("");

  const datasets =
    DATASETS_BY_ROLE[user.role] === "all"
      ? Object.keys(QUERIES)
      : DATASETS_BY_ROLE[user.role] || [];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr("");
      const out = { ...EMPTY };
      await Promise.all(
        datasets.map(async (key) => {
          try {
            const res = await gql(QUERIES[key], { t: user.tenant_id });
            out[key] = res[FIELD_OF[key]] ?? EMPTY[key];
          } catch {
            out[key] = EMPTY[key]; // unauthorized/offline → keep fallback
          }
        })
      );
      if (!cancelled) setData(out);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user.tenant_id, user.role, reload]);

  const refresh = () => setReload((n) => n + 1);
  const alerts = useMemo(() => buildAlerts(data), [data]);
  const canUpload = ["ADMIN", "PROJECT_MANAGER", "COMPLIANCE_OFFICER"].includes(
    user.role
  );

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

  async function mutate(query, variables) {
    setErr("");
    try {
      await gql(query, { ...variables, t: user.tenant_id });
      refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function startCheckout(plan) {
    setErr("");
    setCheckout(null);
    try {
      const d = await gql(
        `mutation($t:ID!,$p:String!){createBillingCheckout(tenant_id:$t,plan_type:$p){url driver plan_type}}`,
        { t: user.tenant_id, p: plan }
      );
      setCheckout(d.createBillingCheckout);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function runIntegration(mutationField) {
    setErr("");
    setIntegrationMsg("");
    try {
      const d = await gql(
        `mutation($t:ID!){${mutationField}(tenant_id:$t){integration status detail driver reference}}`,
        { t: user.tenant_id }
      );
      const r = d[mutationField];
      setIntegrationMsg(
        `${r.integration} [${r.driver}] ${r.status}: ${r.detail} (ref ${r.reference})`
      );
      refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  const quickActions = {
    ENGINEER: [
      { label: tr("qa.newDPR"), onClick: () => setModal("dpr") },
      { label: tr("qa.logSafety"), onClick: () => setModal("safety") },
    ],
    ACCOUNTANT: [{ label: tr("qa.newFinance"), onClick: () => setModal("finance") }],
    PROJECT_MANAGER: [{ label: tr("qa.newContract"), onClick: () => setModal("contract") }],
    ADMIN: [
      { label: tr("qa.newContract"), onClick: () => setModal("contract") },
      { label: tr("qa.newFinance"), onClick: () => setModal("finance") },
    ],
    COMPLIANCE_OFFICER: [],
  }[user.role];

  const home =
    user.role === "ENGINEER" ? (
      <EngineerHome data={data} />
    ) : user.role === "ACCOUNTANT" ? (
      <AccountantHome data={data} mutate={mutate} />
    ) : user.role === "COMPLIANCE_OFFICER" ? (
      <OfficerHome data={data} />
    ) : (
      <PMHome
        data={data}
        alerts={alerts}
        mutate={mutate}
        canApprove={["ADMIN", "PROJECT_MANAGER"].includes(user.role)}
      />
    );

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar tabs={tabs} tab={tab} setTab={setTab} quickActions={quickActions} />

      <div className="flex-1 min-w-0">
        <TopBar user={user} tenant={tenant} alerts={alerts} onLogout={onLogout} />

        <main className="p-6 grid gap-5 md:grid-cols-2" aria-live="polite">
          {err && (
            <p className="text-danger col-span-2" role="alert">
              {err}
            </p>
          )}

          {tab === "home" && home}
          {tab === "map" && <ProjectMap sites={data.sites} />}
          {tab === "compliance" && <ComplianceModule data={data} />}
          {tab === "audit" && <AuditModule data={data} />}
          {tab === "ai" && <AIModule data={data} />}
          {tab === "contracts" && (
            <ContractsModule
              data={data}
              canUpload={canUpload}
              handleUpload={handleUpload}
            />
          )}
          {tab === "finance" && <AccountantHome data={data} mutate={mutate} />}
          {tab === "safety" && <SafetyModule data={data} />}
          {tab === "environment" && <EnvironmentModule data={data} />}
          {tab === "labour" && (
            <LabourModule
              data={data}
              canAct={["ADMIN", "ACCOUNTANT", "COMPLIANCE_OFFICER"].includes(user.role)}
              mutate={mutate}
            />
          )}
          {tab === "rera" && (
            <ReraModule data={data} canAct={canUpload} mutate={mutate} />
          )}
          {tab === "vendors" && (
            <VendorsModule data={data} canAct={canUpload} mutate={mutate} />
          )}
          {tab === "disputes" && (
            <DisputesModule data={data} canAct={canUpload} mutate={mutate} />
          )}
          {tab === "billing" && (
            <BillingModule
              data={data}
              checkout={checkout}
              startCheckout={startCheckout}
              mutate={mutate}
            />
          )}
          {tab === "integrations" && (
            <IntegrationsModule
              data={data}
              integrationMsg={integrationMsg}
              runIntegration={runIntegration}
            />
          )}
        </main>
      </div>

      <NewDPRModal
        open={modal === "dpr"}
        onClose={() => setModal(null)}
        tenantId={user.tenant_id}
        onDone={refresh}
      />
      <SafetyAuditModal
        open={modal === "safety"}
        onClose={() => setModal(null)}
        tenantId={user.tenant_id}
        onDone={refresh}
      />
      <FinanceModal
        open={modal === "finance"}
        onClose={() => setModal(null)}
        tenantId={user.tenant_id}
        onDone={refresh}
      />
      <ContractModal
        open={modal === "contract"}
        onClose={() => setModal(null)}
        tenantId={user.tenant_id}
        onDone={refresh}
      />
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
