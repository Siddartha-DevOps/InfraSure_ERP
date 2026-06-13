// Reports & Analytics module + Approvals center.
import { Card, Kpi, StatusPill, LineChart, Button } from "./ui.jsx";
import {
  DonutChart,
  ScoreGauge,
  DataTable,
  EmptyState,
  Section,
} from "./widgets.jsx";
import { downloadCsv } from "./export.js";
import { useI18n } from "./i18n.jsx";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const day = (iso) => (iso || "").slice(0, 10);

export function ReportsModule({ data, loading, errors = {}, onRetry, mutate, role }) {
  const { t } = useI18n();
  const fin = data.finance || [];
  const gstFiled = fin.filter((f) => f.gst_filing_status === "FILED").length;
  const gstPending = fin.length - gstFiled;
  const a = data.audit;
  const canCapture =
    mutate && ["COMPLIANCE_OFFICER", "PROJECT_MANAGER", "ADMIN", "COMPANY_ADMIN"].includes(role);
  // Map readiness snapshots → {label: month, value: score} for the line chart.
  const readinessTrend = (data.readinessTrend || []).map((s) => ({
    label: (s.captured_at || "").slice(0, 7),
    value: s.score,
  }));
  const captureSnapshot = () =>
    mutate(
      `mutation($t:ID!){captureAuditReadinessSnapshot(tenant_id:$t){snapshot_id score}}`,
      {}
    );

  function exportContracts() {
    downloadCsv("contracts.csv", data.contracts || [], [
      { header: "Title", value: (r) => r.title },
      { header: "Status", value: (r) => r.status },
      { header: "Expiry", value: (r) => day(r.expiry_date) },
      { header: "Version", value: (r) => r.version },
    ]);
  }
  function exportFinance() {
    downloadCsv("finance.csv", fin, [
      { header: "Invoice", value: (r) => r.invoice_number },
      { header: "Amount", value: (r) => r.amount },
      { header: "GST", value: (r) => r.gst_filing_status },
      { header: "TDS", value: (r) => r.tds_status },
      { header: "RA bill", value: (r) => r.ra_bill_status },
      { header: "Due", value: (r) => day(r.due_date) },
      { header: "Paid", value: (r) => day(r.paid_date) },
    ]);
  }
  function exportAudit() {
    downloadCsv("audit-log.csv", data.auditFeed || [], [
      { header: "Action", value: (r) => r.action },
      { header: "User", value: (r) => r.user_id },
      { header: "Timestamp", value: (r) => r.timestamp },
    ]);
  }
  function exportSafety() {
    downloadCsv("safety.csv", data.safety || [], [
      { header: "Site", value: (r) => r.site_name },
      { header: "Date", value: (r) => day(r.audit_date) },
      { header: "Status", value: (r) => r.checklist_status },
      { header: "PPE%", value: (r) => r.ppe_compliance },
    ]);
  }

  return (
    <>
      <Card title={t("rep.gstPie")}>
        <Section loading={loading} error={errors.finance} onRetry={onRetry}>
          <DonutChart
            data={[
              { label: t("rep.gstFiled"), value: gstFiled, color: "#10B981" },
              { label: t("rep.gstPending"), value: gstPending, color: "#F59E0B" },
            ]}
          />
        </Section>
      </Card>

      <Card title={t("rep.readiness")}>
        <Section loading={loading} error={errors.audit} onRetry={onRetry}>
          {a ? (
            <div className="flex items-center gap-4">
              <ScoreGauge label={t("kpi.readiness")} value={a.audit_readiness_score} />
              <div className="grid grid-cols-1 gap-2 text-sm">
                <Kpi label={t("kpi.docsVerified")} value={`${a.documents_verified}/${a.documents_total}`} suffix="" />
              </div>
            </div>
          ) : (
            <EmptyState icon="🗂️" title={t("empty.noAudit")} />
          )}
        </Section>
      </Card>

      <Card title={t("rep.trend")} wide>
        <Section loading={loading} error={errors.trend} onRetry={onRetry}>
          {(data.trend || []).length ? (
            <>
              <LineChart data={data.trend} />
              <p className="text-xs text-neutral mt-1">{t("rep.gstFiled")} % / {t("th.period")}</p>
            </>
          ) : (
            <EmptyState icon="📈" title={t("rep.noTrend")} />
          )}
        </Section>
      </Card>

      <Card
        title={t("rep.readinessTrend")}
        wide
        action={
          canCapture ? (
            <Button variant="secondary" onClick={captureSnapshot}>
              📸 {t("rep.captureSnapshot")}
            </Button>
          ) : null
        }
      >
        <Section loading={loading} error={errors.readinessTrend} onRetry={onRetry}>
          {readinessTrend.length ? (
            <>
              <LineChart data={readinessTrend} color="#1E3A8A" />
              <p className="text-xs text-neutral mt-1">
                {t("kpi.readiness")} % / {t("th.period")}
              </p>
            </>
          ) : (
            <EmptyState icon="🗂️" title={t("rep.noReadinessTrend")} />
          )}
        </Section>
      </Card>

      <Card title={t("rep.export")} wide>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportContracts}>⬇ {t("rep.exportContracts")}</Button>
          <Button variant="secondary" onClick={exportFinance}>⬇ {t("rep.exportFinance")}</Button>
          <Button variant="secondary" onClick={exportSafety}>⬇ {t("rep.exportSafety")}</Button>
          <Button variant="secondary" onClick={exportAudit}>⬇ {t("rep.exportAudit")}</Button>
        </div>
        <p className="text-xs text-neutral mt-3">RERA / GST / labour exports as CSV for external audits.</p>
      </Card>
    </>
  );
}

// ---------------- Approvals center ----------------
export function ApprovalsModule({ data, loading, errors = {}, onRetry, mutate, role }) {
  const { t } = useI18n();

  // Build a unified approval queue from everything pending across modules.
  const items = [];
  const canWF = ["ADMIN", "COMPANY_ADMIN", "PROJECT_MANAGER"].includes(role);
  const canFinance = ["ADMIN", "COMPANY_ADMIN", "ACCOUNTANT"].includes(role);
  const canLabour = ["ADMIN", "COMPANY_ADMIN", "ACCOUNTANT", "COMPLIANCE_OFFICER"].includes(role);
  const canRera = ["ADMIN", "COMPANY_ADMIN", "PROJECT_MANAGER", "COMPLIANCE_OFFICER"].includes(role);

  for (const s of data.steps || [])
    if (s.status === "PENDING")
      items.push({
        id: s.step_id, kind: "workflow", label: s.name,
        can: canWF,
        run: () => mutate(`mutation($t:ID!,$id:ID!){approveWorkflowStep(tenant_id:$t,step_id:$id){step_id}}`, { id: s.step_id }),
        actLabel: t("btn.approve"),
      });
  for (const f of data.finance || [])
    if (f.ra_bill_status !== "APPROVED")
      items.push({
        id: f.finance_id, kind: "rabill", label: `${f.invoice_number || f.finance_id} · ${inr(f.amount)}`,
        can: canFinance,
        run: () => mutate(`mutation($t:ID!,$id:ID!){approveRABill(tenant_id:$t,finance_id:$id){finance_id}}`, { id: f.finance_id }),
        actLabel: t("btn.approve"),
      });
  for (const l of data.labour || [])
    if (l.status !== "FILED")
      items.push({
        id: l.labour_id, kind: "labour", label: `${l.filing_type} · ${l.period}`,
        can: canLabour,
        run: () => mutate(`mutation($t:ID!,$id:ID!){updateLabourFilingStatus(tenant_id:$t,labour_id:$id,status:"FILED"){labour_id}}`, { id: l.labour_id }),
        actLabel: t("appr.fileNow"),
      });
  for (const r of data.rera || [])
    if (r.status === "PENDING")
      items.push({
        id: r.filing_id, kind: "rera", label: r.project_name,
        can: canRera,
        run: () => mutate(`mutation($t:ID!,$id:ID!){updateReraFilingStatus(tenant_id:$t,filing_id:$id,status:"FILED"){filing_id}}`, { id: r.filing_id }),
        actLabel: t("appr.fileNow"),
      });

  return (
    <Card title={t("appr.title")} wide>
      <Section
        loading={loading}
        error={errors.steps || errors.finance}
        onRetry={onRetry}
        empty={items.length === 0 && <EmptyState icon="✅" title={t("appr.empty")} />}
      >
        <DataTable
          rows={items}
          columns={[
            { key: "kind", header: t("appr.type"), value: (r) => r.kind,
              render: (r) => <StatusPill value={r.kind === "workflow" ? "PENDING" : "DUE"} /> },
            { key: "label", header: t("appr.item"), value: (r) => r.label },
            { key: "act", header: t("appr.action"), value: () => "",
              render: (r) =>
                r.can ? (
                  <button onClick={r.run} className="text-primary underline text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                    {r.actLabel}
                  </button>
                ) : (
                  <span className="text-xs text-neutral">—</span>
                ) },
          ]}
          empty={<EmptyState icon="✅" title={t("appr.empty")} />}
        />
      </Section>
    </Card>
  );
}
