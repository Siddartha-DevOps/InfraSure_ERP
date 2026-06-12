// Phase 1 role dashboards: Super Admin, Company Admin, Project Manager.
// Built entirely on the existing Tailwind design system + shared widget library.
// Each data card runs the full loading → error → empty → content lifecycle via <Section>.
import { Card, Kpi, StatusPill } from "./ui.jsx";
import {
  ScoreGauge,
  DonutChart,
  DataTable,
  AuditFeed,
  NotificationsCenter,
  MiniCalendar,
  TasksWidget,
  EmptyState,
  KpiSkeleton,
  LoadingSkeleton,
  Section,
} from "./widgets.jsx";
import { ProjectMap } from "./ProjectMap.jsx";
import { useI18n } from "./i18n.jsx";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Derive calendar events (compliance deadlines) from loaded data.
function calendarEvents(data) {
  const ev = [];
  for (const c of data.contracts || [])
    ev.push({ date: c.expiry_date, label: `Contract: ${c.title}`, severity: "warning" });
  for (const r of data.rera || [])
    if (r.status === "PENDING")
      ev.push({ date: r.due_date, label: `RERA: ${r.project_name}`, severity: "critical" });
  for (const f of data.finance || [])
    if (!f.paid_date)
      ev.push({ date: f.due_date, label: `Payment: ${f.invoice_number || f.finance_id}`, severity: "warning" });
  return ev;
}

function ScoresRow({ summary }) {
  const { t } = useI18n();
  if (!summary) return <EmptyState icon="📊" title={t("empty.noKpi")} />;
  return (
    <div className="grid grid-cols-3 gap-2">
      <ScoreGauge label={t("score.compliance")} value={summary.compliance_score} />
      <ScoreGauge label={t("score.risk")} value={summary.risk_score} invert />
      <ScoreGauge label={t("score.health")} value={summary.project_health_score} />
    </div>
  );
}

// ---------------- Super Admin ----------------
export function SuperAdminHome({ data, loading, errors = {}, onRetry }) {
  const { t } = useI18n();
  const s = data.platformStats;
  const PLAN_COLOR = { BASIC: "#6B7280", PRO: "#1E3A8A", ENTERPRISE: "#10B981" };
  const planMix = ["BASIC", "PRO", "ENTERPRISE"].map((code) => ({
    label: code,
    value: (data.tenants || []).filter((tn) => tn.subscription_plan === code).length,
    color: PLAN_COLOR[code],
  }));

  return (
    <>
      <Card title={t("sa.title")} wide>
        <Section
          loading={loading}
          error={errors.platformStats}
          empty={!s && <EmptyState icon="🏢" title={t("empty.noKpi")} />}
          onRetry={onRetry}
          skeleton={<KpiSkeleton count={7} />}
        >
          {s && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label={t("sa.tenants")} value={s.total_tenants} suffix="" />
              <Kpi label={t("sa.users")} value={s.total_users} suffix="" />
              <Kpi label={t("sa.contracts")} value={s.total_contracts} suffix="" />
              <Kpi label={t("sa.subs")} value={s.active_subscriptions} suffix="" />
              <div className="bg-surface rounded-lg p-4">
                <p className="text-xs text-neutral">{t("sa.mrr")}</p>
                <p className="text-2xl font-semibold text-gray-800">{inr(s.mrr_inr)}</p>
              </div>
              <Kpi label={t("sa.avgCompliance")} value={s.avg_compliance} />
              <Kpi label={t("sa.disputes")} value={s.open_disputes} suffix="" invert />
            </div>
          )}
        </Section>
      </Card>

      <Card title={t("sa.planMix")}>
        <Section loading={loading} error={errors.tenants} onRetry={onRetry}>
          <DonutChart data={planMix} />
        </Section>
      </Card>

      <Card title={t("sa.platformAudit")}>
        <Section loading={loading} error={errors.platformAuditFeed} onRetry={onRetry}>
          <AuditFeed entries={data.platformAuditFeed} showTenant />
        </Section>
      </Card>

      <Card title={t("sa.tenantTable")} wide>
        <Section
          loading={loading}
          error={errors.tenants}
          onRetry={onRetry}
          skeleton={<LoadingSkeleton rows={4} />}
        >
          <DataTable
            rows={data.tenants || []}
            columns={[
              { key: "name", header: t("th.tenant"), value: (r) => r.company_name },
              { key: "plan", header: t("th.plan"), value: (r) => r.subscription_plan,
                render: (r) => <StatusPill value={r.subscription_plan === "BASIC" ? "DRAFT" : "ACTIVE"} /> },
              { key: "users", header: t("th.userCount"), value: (r) => r.user_count },
              { key: "contracts", header: t("th.contractCount"), value: (r) => r.contract_count },
              { key: "score", header: t("co.score"), value: (r) => r.compliance_score,
                render: (r) => (
                  <span className={r.compliance_score >= 85 ? "text-success-text" : r.compliance_score >= 60 ? "text-warning-text" : "text-danger-text"}>
                    {r.compliance_score}%
                  </span>
                ) },
            ]}
            empty={<EmptyState icon="🏢" title="No tenants yet." />}
          />
        </Section>
      </Card>
    </>
  );
}

// ---------------- Company Admin ----------------
export function CompanyAdminHome({ data, loading, errors = {}, onRetry, alerts, calendar }) {
  const { t } = useI18n();
  return (
    <>
      <Card title={t("ca.scores")} wide>
        <Section loading={loading} error={errors.dashboardSummary} onRetry={onRetry} skeleton={<KpiSkeleton count={3} />}>
          <ScoresRow summary={data.dashboardSummary} />
        </Section>
      </Card>

      <Card title={t("ca.title")}>
        <Section loading={loading} error={errors.contracts} onRetry={onRetry} skeleton={<KpiSkeleton count={4} />}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label={t("kpi.activeContracts")} value={(data.contracts || []).length} suffix="" />
            <Kpi label={t("ca.users")} value={(data.users || []).length} suffix="" />
            <Kpi label={t("kpi.overdue")} value={data.dashboardSummary?.expiring_contracts ?? 0} suffix="" invert />
            <Kpi label={t("kpi.openDisputes")} value={(data.disputes || []).filter((d) => d.status !== "RESOLVED").length} suffix="" invert />
          </div>
        </Section>
      </Card>

      <Card title={t("notif.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <NotificationsCenter alerts={alerts} />
        </Section>
      </Card>

      <Card title={t("calendar.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <MiniCalendar events={calendar} />
        </Section>
      </Card>

      <Card title={t("audit.feed")}>
        <Section loading={loading} error={errors.auditFeed} onRetry={onRetry}>
          <AuditFeed entries={data.auditFeed} />
        </Section>
      </Card>

      <Card title={t("ca.team")} wide>
        <Section loading={loading} error={errors.users} onRetry={onRetry} skeleton={<LoadingSkeleton rows={4} />}>
          <DataTable
            rows={data.users || []}
            columns={[
              { key: "email", header: t("ca.email"), value: (r) => r.email },
              { key: "role", header: t("ca.role"), value: (r) => r.role,
                render: (r) => <span className="text-gray-700">{r.role.replace("_", " ")}</span> },
              { key: "status", header: t("th.status"), value: (r) => r.status,
                render: (r) => <StatusPill value={r.status} /> },
            ]}
            empty={<EmptyState icon="👥" title="No team members." />}
          />
        </Section>
      </Card>
    </>
  );
}

// ---------------- Project Manager ----------------
export function ProjectManagerHome({ data, loading, errors = {}, onRetry, alerts, calendar, mutate, canApprove }) {
  const { t } = useI18n();
  const pendingSteps = (data.steps || []).filter((s) => s.status === "PENDING");
  return (
    <>
      <Card title={t("ca.scores")} wide>
        <Section loading={loading} error={errors.dashboardSummary} onRetry={onRetry} skeleton={<KpiSkeleton count={3} />}>
          <ScoresRow summary={data.dashboardSummary} />
        </Section>
      </Card>

      <Card title={t("card.portfolio")}>
        <Section loading={loading} error={errors.contracts} onRetry={onRetry} skeleton={<KpiSkeleton count={4} />}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label={t("kpi.activeContracts")} value={(data.contracts || []).length} suffix="" />
            <Kpi label={t("kpi.safetyCompletion")} value={data.kpis ? data.kpis.safety_audit_completion : 0} />
            <Kpi label={t("kpi.openDisputes")} value={(data.disputes || []).filter((d) => d.status !== "RESOLVED").length} suffix="" invert />
            <Kpi label={t("kpi.overdue")} value={data.kpis ? data.kpis.overdue_payments : 0} suffix="" invert />
          </div>
        </Section>
      </Card>

      <Card title={t("notif.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <NotificationsCenter alerts={alerts} />
        </Section>
      </Card>

      {!loading && !errors.sites && <ProjectMap sites={data.sites} />}

      <Card title={t("calendar.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <MiniCalendar events={calendar} />
        </Section>
      </Card>

      <Card title={t("tasks.title")}>
        <Section loading={loading} error={errors.steps} onRetry={onRetry}>
          <TasksWidget
            tasks={pendingSteps.map((s) => ({ id: s.step_id, label: s.name, meta: t("status.PENDING") }))}
            onAct={canApprove ? (task) => mutate(
              `mutation($t:ID!,$id:ID!){approveWorkflowStep(tenant_id:$t,step_id:$id){step_id}}`,
              { id: task.id }
            ) : undefined}
            actLabel={canApprove ? t("btn.approve") : undefined}
          />
        </Section>
      </Card>

      <Card title={t("co.contractors")} wide>
        <Section loading={loading} error={errors.contractors} onRetry={onRetry} skeleton={<LoadingSkeleton rows={3} />}>
          <DataTable
            rows={data.contractors || []}
            columns={[
              { key: "name", header: t("th.vendor"), value: (r) => r.name },
              { key: "trade", header: t("co.trade"), value: (r) => r.trade || "—" },
              { key: "proj", header: t("co.projects"), value: (r) => r.active_projects },
              { key: "score", header: t("co.score"), value: (r) => r.compliance_score,
                render: (r) => (
                  <span className={r.compliance_score >= 85 ? "text-success-text" : r.compliance_score >= 60 ? "text-warning-text" : "text-danger-text"}>
                    {r.compliance_score}%
                  </span>
                ) },
              { key: "status", header: t("th.status"), value: (r) => r.status,
                render: (r) => <StatusPill value={r.status} /> },
            ]}
            empty={<EmptyState icon="🤝" title="No subcontractors registered." />}
          />
        </Section>
      </Card>

      <Card title={t("audit.feed")}>
        <Section loading={loading} error={errors.auditFeed} onRetry={onRetry}>
          <AuditFeed entries={data.auditFeed} />
        </Section>
      </Card>
    </>
  );
}

export { calendarEvents };
