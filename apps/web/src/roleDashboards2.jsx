// Phase 2 role dashboards: Site Engineer, Accountant, Compliance Officer.
// Same widget system + <Section> lifecycle as the Phase 1 dashboards.
import { Card, Kpi, StatusPill, BarChart } from "./ui.jsx";
import {
  ScoreGauge,
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
const day = (iso) => (iso || "").slice(0, 10);
const pct = (n, total) => (total === 0 ? 100 : Math.round((n / total) * 100));

function Scores({ summary, loading, error, onRetry }) {
  const { t } = useI18n();
  return (
    <Card title={t("ca.scores")} wide>
      <Section loading={loading} error={error} onRetry={onRetry} skeleton={<KpiSkeleton count={3} />}>
        {!summary ? (
          <EmptyState icon="📊" title={t("empty.noKpi")} />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <ScoreGauge label={t("score.compliance")} value={summary.compliance_score} />
            <ScoreGauge label={t("score.risk")} value={summary.risk_score} invert />
            <ScoreGauge label={t("score.health")} value={summary.project_health_score} />
          </div>
        )}
      </Section>
    </Card>
  );
}

// ---------------- Site Engineer ----------------
export function SiteEngineerHome({ data, loading, errors = {}, onRetry, alerts, calendar }) {
  const { t } = useI18n();
  const safety = data.safety || [];
  const done = safety.filter((s) => s.checklist_status === "COMPLETED").length;
  const avgPpe = safety.length
    ? Math.round(safety.reduce((a, s) => a + (s.ppe_compliance || 0), 0) / safety.length)
    : 0;
  const pendingTasks = (data.steps || []).filter((s) => s.status === "PENDING");

  return (
    <>
      <Scores summary={data.dashboardSummary} loading={loading} error={errors.dashboardSummary} onRetry={onRetry} />

      <Card title={t("card.siteKpis")}>
        <Section loading={loading} error={errors.safety} onRetry={onRetry} skeleton={<KpiSkeleton count={4} />}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label={t("kpi.safetyDone")} value={pct(done, safety.length)} />
            <Kpi label={t("kpi.avgPpe")} value={avgPpe} />
            <Kpi label={t("kpi.dprsFiled")} value={(data.dprs || []).length} suffix="" />
            <Kpi label={t("kpi.pendingTasks")} value={pendingTasks.length} suffix="" invert />
          </div>
        </Section>
      </Card>

      <Card title={t("notif.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <NotificationsCenter alerts={alerts} />
        </Section>
      </Card>

      {!loading && !errors.sites && <ProjectMap sites={data.sites} />}

      <Card title={t("card.pendingTasks")}>
        <Section loading={loading} error={errors.steps} onRetry={onRetry}>
          <TasksWidget tasks={pendingTasks.map((s) => ({ id: s.step_id, label: s.name, meta: t("status.PENDING") }))} />
        </Section>
      </Card>

      <Card title={t("calendar.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <MiniCalendar events={calendar} />
        </Section>
      </Card>

      <Card title={t("card.recentDprs")} wide>
        <Section loading={loading} error={errors.dprs} onRetry={onRetry} skeleton={<LoadingSkeleton rows={4} />}>
          <DataTable
            rows={data.dprs || []}
            columns={[
              { key: "date", header: t("th.date"), value: (r) => day(r.created_at) },
              { key: "report", header: t("th.report"),
                value: (r) => r.report_data,
                render: (r) => (
                  <span className="text-gray-700">
                    {r.report_data.length > 120 ? `${r.report_data.slice(0, 120)}…` : r.report_data}
                  </span>
                ) },
            ]}
            empty={<EmptyState icon="📝" title={t("empty.noDprs")} />}
          />
        </Section>
      </Card>

      <Card title={t("card.safetyAudits")} wide>
        <Section loading={loading} error={errors.safety} onRetry={onRetry} skeleton={<LoadingSkeleton rows={4} />}>
          <DataTable
            rows={safety}
            columns={[
              { key: "site", header: t("th.site"), value: (r) => r.site_name || "—" },
              { key: "date", header: t("th.date"), value: (r) => day(r.audit_date) },
              { key: "status", header: t("th.status"), value: (r) => r.checklist_status,
                render: (r) => <StatusPill value={r.checklist_status} /> },
              { key: "ppe", header: t("th.ppe"), value: (r) => r.ppe_compliance,
                render: (r) => (
                  <span className={r.ppe_compliance >= 85 ? "text-success-text" : r.ppe_compliance >= 60 ? "text-warning-text" : "text-danger-text"}>
                    {r.ppe_compliance}%
                  </span>
                ) },
            ]}
            empty={<EmptyState icon="🦺" title="No safety audits yet." />}
          />
        </Section>
      </Card>
    </>
  );
}

// ---------------- Accountant ----------------
export function AccountantDashboard({ data, loading, errors = {}, onRetry, alerts, calendar, mutate }) {
  const { t } = useI18n();
  const fin = data.finance || [];
  const overdue = fin.filter((f) => !f.paid_date && new Date(f.due_date) < new Date()).length;

  return (
    <>
      <Scores summary={data.dashboardSummary} loading={loading} error={errors.dashboardSummary} onRetry={onRetry} />

      <Card title={t("card.financeKpis")}>
        <Section loading={loading} error={errors.kpis} onRetry={onRetry} skeleton={<KpiSkeleton count={4} />}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label={t("kpi.gst")} value={data.kpis ? data.kpis.gst_filing_compliance : 0} />
            <Kpi label={t("kpi.tds")} value={data.kpis ? data.kpis.tds_filing_compliance : 0} />
            <Kpi label={t("kpi.ra")} value={data.kpis ? data.kpis.ra_bill_approval_rate : 0} />
            <Kpi label={t("kpi.overdue")} value={overdue} suffix="" invert />
          </div>
        </Section>
      </Card>

      <Card title={t("card.filingStatus")}>
        <Section loading={loading} error={errors.finance} onRetry={onRetry}>
          <BarChart
            data={[
              { label: "GST✓", value: fin.filter((f) => f.gst_filing_status === "FILED").length },
              { label: "GST•", value: fin.filter((f) => f.gst_filing_status !== "FILED").length },
              { label: "TDS✓", value: fin.filter((f) => f.tds_status === "FILED").length },
              { label: "TDS•", value: fin.filter((f) => f.tds_status !== "FILED").length },
              { label: "RA✓", value: fin.filter((f) => f.ra_bill_status === "APPROVED").length },
              { label: "RA•", value: fin.filter((f) => f.ra_bill_status !== "APPROVED").length },
            ]}
          />
        </Section>
      </Card>

      <Card title={t("card.filings")} wide>
        <Section loading={loading} error={errors.finance} onRetry={onRetry} skeleton={<LoadingSkeleton rows={4} />}>
          <DataTable
            rows={fin}
            columns={[
              { key: "inv", header: t("th.invoice"), value: (r) => r.invoice_number || "—" },
              { key: "amt", header: t("th.amount"), value: (r) => inr(r.amount) },
              { key: "gst", header: t("th.gst"), value: (r) => r.gst_filing_status, render: (r) => <StatusPill value={r.gst_filing_status} /> },
              { key: "tds", header: t("th.tds"), value: (r) => r.tds_status, render: (r) => <StatusPill value={r.tds_status} /> },
              { key: "ra", header: t("th.raBill"), value: (r) => r.ra_bill_status, render: (r) => <StatusPill value={r.ra_bill_status} /> },
              { key: "act", header: "", value: () => "",
                render: (r) => (
                  <span className="space-x-2 whitespace-nowrap text-xs">
                    {r.gst_filing_status !== "FILED" && (
                      <button className="text-primary underline" onClick={() => mutate(`mutation($t:ID!,$id:ID!){fileGST(tenant_id:$t,finance_id:$id){finance_id}}`, { id: r.finance_id })}>{t("btn.fileGst")}</button>
                    )}
                    {r.tds_status !== "FILED" && (
                      <button className="text-primary underline" onClick={() => mutate(`mutation($t:ID!,$id:ID!){fileTDS(tenant_id:$t,finance_id:$id){finance_id}}`, { id: r.finance_id })}>{t("btn.fileTds")}</button>
                    )}
                    {r.ra_bill_status !== "APPROVED" && (
                      <button className="text-success-text underline" onClick={() => mutate(`mutation($t:ID!,$id:ID!){approveRABill(tenant_id:$t,finance_id:$id){finance_id}}`, { id: r.finance_id })}>{t("btn.approveRa")}</button>
                    )}
                    {!r.paid_date && (
                      <button className="text-neutral underline" onClick={() => mutate(`mutation($t:ID!,$id:ID!){recordPayment(tenant_id:$t,finance_id:$id){finance_id}}`, { id: r.finance_id })}>{t("btn.recordPayment")}</button>
                    )}
                  </span>
                ) },
            ]}
            empty={<EmptyState icon="💰" title="No finance records." />}
          />
        </Section>
      </Card>

      <Card title={t("calendar.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <MiniCalendar events={calendar} />
        </Section>
      </Card>

      <Card title={t("card.labourModule")} wide>
        <Section loading={loading} error={errors.labour} onRetry={onRetry} skeleton={<LoadingSkeleton rows={3} />}>
          <DataTable
            rows={data.labour || []}
            columns={[
              { key: "type", header: t("th.type"), value: (r) => r.filing_type },
              { key: "period", header: t("th.period"), value: (r) => r.period },
              { key: "workers", header: t("th.workers"), value: (r) => r.worker_count },
              { key: "amount", header: t("th.amount"), value: (r) => inr(r.amount) },
              { key: "status", header: t("th.status"), value: (r) => r.status, render: (r) => <StatusPill value={r.status} /> },
            ]}
            empty={<EmptyState icon="👷" title="No labour filings." />}
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

// ---------------- Compliance Officer ----------------
export function ComplianceDashboard({ data, loading, errors = {}, onRetry, alerts, calendar }) {
  const { t } = useI18n();
  const a = data.audit;
  const expiringCerts = (data.vendors || []).filter((v) => {
    if (!v.certification_expiry) return false;
    return (new Date(v.certification_expiry) - new Date()) / 86400000 <= 30;
  });

  return (
    <>
      <Scores summary={data.dashboardSummary} loading={loading} error={errors.dashboardSummary} onRetry={onRetry} />

      <Card title={t("card.auditReadiness")} wide>
        <Section loading={loading} error={errors.audit} onRetry={onRetry} skeleton={<KpiSkeleton count={5} />}>
          {!a ? (
            <EmptyState icon="🗂️" title={t("empty.noAudit")} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label={t("kpi.readiness")} value={a.audit_readiness_score} />
              <Kpi label={t("kpi.vendorCompliance")} value={a.vendor_compliance_rate} />
              <div className="bg-surface rounded-lg p-4">
                <p className="text-xs text-neutral">{t("kpi.docsVerified")}</p>
                <p className="text-2xl font-semibold text-gray-800">{a.documents_verified}/{a.documents_total}</p>
              </div>
              <Kpi label={t("kpi.pendingApprovals")} value={a.pending_approvals} suffix="" invert />
              <Kpi label={t("kpi.openDisputes")} value={a.open_disputes} suffix="" invert />
            </div>
          )}
        </Section>
      </Card>

      <Card title={t("notif.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <NotificationsCenter alerts={alerts} />
        </Section>
      </Card>

      <Card title={t("card.expiringCerts")}>
        <Section loading={loading} error={errors.vendors} onRetry={onRetry}>
          {expiringCerts.length === 0 ? (
            <EmptyState icon="📜" title={t("empty.noCerts")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {expiringCerts.map((v) => (
                <li key={v.vendor_id} className="flex justify-between items-center">
                  <span className="text-gray-700">{v.name} — {v.certification_name}</span>
                  <span className="text-warning-text font-medium">{day(v.certification_expiry)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Card>

      <Card title={t("calendar.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <MiniCalendar events={calendar} />
        </Section>
      </Card>

      <Card title={t("card.envModule")} wide>
        <Section loading={loading} error={errors.environment} onRetry={onRetry} skeleton={<LoadingSkeleton rows={3} />}>
          <DataTable
            rows={data.environment || []}
            columns={[
              { key: "type", header: t("th.type"), value: (r) => r.log_type },
              { key: "reading", header: t("th.reading"), value: (r) => `${r.reading} ${r.unit}` },
              { key: "date", header: t("th.recorded"), value: (r) => day(r.recorded_at) },
              { key: "notes", header: t("th.notes"), value: (r) => r.notes || "—" },
            ]}
            empty={<EmptyState icon="🌿" title="No environmental logs." />}
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
              { key: "score", header: t("co.score"), value: (r) => r.compliance_score,
                render: (r) => (
                  <span className={r.compliance_score >= 85 ? "text-success-text" : r.compliance_score >= 60 ? "text-warning-text" : "text-danger-text"}>
                    {r.compliance_score}%
                  </span>
                ) },
              { key: "status", header: t("th.status"), value: (r) => r.status, render: (r) => <StatusPill value={r.status} /> },
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
