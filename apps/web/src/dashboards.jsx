// Role-specific dashboard home screens.
// Engineer → DPRs, safety, pending tasks · Accountant → filings, RA bills, KPIs ·
// Compliance Officer → readiness, env/labour logs, expiring certs ·
// Project Manager/Admin → portfolio, trends, consolidated alerts.
import {
  Card,
  Kpi,
  StatusPill,
  BarChart,
  LineChart,
  AlertsFeed,
  SiteBoard,
  Button,
} from "./ui.jsx";
import { ProjectMap } from "./ProjectMap.jsx";
import { useI18n } from "./i18n.jsx";

const day = (iso) => (iso || "").slice(0, 10);
const pct = (n, total) => (total === 0 ? 100 : Math.round((n / total) * 100));

function dprTrend(dprs, days = 7) {
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      label: key.slice(8),
      value: (dprs || []).filter((x) => day(x.created_at) === key).length,
    });
  }
  return buckets;
}

// ---------- Engineer ----------
export function EngineerHome({ data }) {
  const { t } = useI18n();
  const safety = data.safety || [];
  const done = safety.filter((s) => s.checklist_status === "COMPLETED").length;
  const avgPpe = safety.length
    ? Math.round(safety.reduce((a, s) => a + (s.ppe_compliance || 0), 0) / safety.length)
    : 0;
  const pendingTasks = (data.steps || []).filter((s) => s.status === "PENDING");

  return (
    <>
      <Card title={t("card.siteKpis")} wide>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={t("kpi.safetyDone")} value={pct(done, safety.length)} />
          <Kpi label={t("kpi.avgPpe")} value={avgPpe} />
          <Kpi label={t("kpi.dprsFiled")} value={(data.dprs || []).length} suffix="" />
          <Kpi label={t("kpi.pendingTasks")} value={pendingTasks.length} suffix="" invert />
        </div>
      </Card>

      <Card title={t("card.siteStatus")}>
        <SiteBoard safety={safety} />
      </Card>

      <Card title={t("card.pendingTasks")}>
        {pendingTasks.length === 0 ? (
          <p className="text-sm text-success-text">{t("empty.noTasks")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pendingTasks.map((s) => (
              <li key={s.step_id} className="flex items-center justify-between">
                <span className="text-gray-700">{s.name}</span>
                <StatusPill value={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("card.recentDprs")} wide>
        {(data.dprs || []).length === 0 ? (
          <p className="text-sm text-neutral">
            {t("empty.noDprs")}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-neutral">
                <th scope="col" className="py-1 font-medium">{t("th.date")}</th>
                <th scope="col" className="font-medium">{t("th.report")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.dprs || []).slice(0, 6).map((d) => (
                <tr key={d.dpr_id} className="border-t border-gray-100">
                  <td className="py-2 whitespace-nowrap">{day(d.created_at)}</td>
                  <td className="text-gray-700">
                    {d.report_data.length > 140
                      ? `${d.report_data.slice(0, 140)}…`
                      : d.report_data}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t("card.safetyAudits")} wide>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-neutral">
              <th scope="col" className="py-1 font-medium">{t("th.site")}</th>
              <th scope="col" className="font-medium">{t("th.date")}</th>
              <th scope="col" className="font-medium">{t("th.status")}</th>
              <th scope="col" className="font-medium">{t("th.ppe")}</th>
            </tr>
          </thead>
          <tbody>
            {safety.map((s) => (
              <tr key={s.safety_id} className="border-t border-gray-100">
                <td className="py-2">{s.site_name || "—"}</td>
                <td>{day(s.audit_date)}</td>
                <td><StatusPill value={s.checklist_status} /></td>
                <td
                  className={
                    s.ppe_compliance >= 85
                      ? "text-success-text font-medium"
                      : s.ppe_compliance >= 60
                      ? "text-warning-text font-medium"
                      : "text-danger-text font-medium"
                  }
                >
                  {s.ppe_compliance}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------- Accountant ----------
export function AccountantHome({ data, mutate }) {
  const { t } = useI18n();
  const fin = data.finance || [];
  const overdue = fin.filter(
    (f) => !f.paid_date && new Date(f.due_date) < new Date()
  ).length;
  const k = data.kpis;

  return (
    <>
      <Card title={t("card.financeKpis")} wide>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={t("kpi.gst")} value={k ? k.gst_filing_compliance : 0} />
          <Kpi label={t("kpi.tds")} value={k ? k.tds_filing_compliance : 0} />
          <Kpi label={t("kpi.ra")} value={k ? k.ra_bill_approval_rate : 0} />
          <Kpi label={t("kpi.overdue")} value={overdue} suffix="" invert />
        </div>
      </Card>

      <Card title={t("card.filingStatus")}>
        <BarChart
          data={[
            {
              label: "GST ✓",
              value: fin.filter((f) => f.gst_filing_status === "FILED").length,
            },
            {
              label: "GST •",
              value: fin.filter((f) => f.gst_filing_status !== "FILED").length,
            },
            {
              label: "TDS ✓",
              value: fin.filter((f) => f.tds_status === "FILED").length,
            },
            {
              label: "TDS •",
              value: fin.filter((f) => f.tds_status !== "FILED").length,
            },
            {
              label: "RA ✓",
              value: fin.filter((f) => f.ra_bill_status === "APPROVED").length,
            },
            {
              label: "RA •",
              value: fin.filter((f) => f.ra_bill_status !== "APPROVED").length,
            },
          ]}
        />
      </Card>

      <Card title={t("card.amountsByMonth")}>
        <LineChart
          data={Object.entries(
            fin.reduce((acc, f) => {
              const m = day(f.due_date).slice(0, 7);
              acc[m] = (acc[m] || 0) + f.amount;
              return acc;
            }, {})
          )
            .sort()
            .map(([m, v]) => ({ label: m.slice(5), value: Math.round(v / 1000) }))}
        />
        <p className="text-xs text-neutral">{t("misc.thousandsPerMonth")}</p>
      </Card>

      <Card title={t("card.filings")} wide>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-neutral">
              <th scope="col" className="py-1 font-medium">{t("th.invoice")}</th>
              <th scope="col" className="font-medium">{t("th.amount")}</th>
              <th scope="col" className="font-medium">{t("th.gst")}</th>
              <th scope="col" className="font-medium">{t("th.tds")}</th>
              <th scope="col" className="font-medium">{t("th.raBill")}</th>
              <th scope="col" className="font-medium">{t("th.payment")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fin.map((f) => {
              const isOverdue = !f.paid_date && new Date(f.due_date) < new Date();
              return (
                <tr key={f.finance_id} className="border-t border-gray-100">
                  <td className="py-2">{f.invoice_number || "—"}</td>
                  <td>₹{Number(f.amount).toLocaleString("en-IN")}</td>
                  <td><StatusPill value={f.gst_filing_status} /></td>
                  <td><StatusPill value={f.tds_status} /></td>
                  <td><StatusPill value={f.ra_bill_status} /></td>
                  <td>
                    <StatusPill
                      value={f.paid_date ? "PAID" : isOverdue ? "OVERDUE" : "DUE"}
                    />
                  </td>
                  <td className="space-x-2 whitespace-nowrap text-xs">
                    {f.gst_filing_status !== "FILED" && (
                      <button
                        className="text-primary underline"
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){fileGST(tenant_id:$t,finance_id:$id){finance_id}}`,
                            { id: f.finance_id }
                          )
                        }
                      >
                        {t("btn.fileGst")}
                      </button>
                    )}
                    {f.tds_status !== "FILED" && (
                      <button
                        className="text-primary underline"
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){fileTDS(tenant_id:$t,finance_id:$id){finance_id}}`,
                            { id: f.finance_id }
                          )
                        }
                      >
                        {t("btn.fileTds")}
                      </button>
                    )}
                    {f.ra_bill_status !== "APPROVED" && (
                      <button
                        className="text-success-text underline"
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){approveRABill(tenant_id:$t,finance_id:$id){finance_id}}`,
                            { id: f.finance_id }
                          )
                        }
                      >
                        {t("btn.approveRa")}
                      </button>
                    )}
                    {!f.paid_date && (
                      <button
                        className="text-neutral underline"
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){recordPayment(tenant_id:$t,finance_id:$id){finance_id}}`,
                            { id: f.finance_id }
                          )
                        }
                      >
                        {t("btn.recordPayment")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------- Compliance Officer ----------
export function OfficerHome({ data }) {
  const { t } = useI18n();
  const audit = data.audit;
  const certVendors = (data.vendors || []).filter((v) => {
    if (!v.certification_expiry) return false;
    return (new Date(v.certification_expiry) - new Date()) / 86400000 <= 30;
  });

  return (
    <>
      <Card title={t("card.auditReadiness")} wide>
        {!audit ? (
          <p className="text-sm text-neutral">{t("empty.noAudit")}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi label={t("kpi.readinessScore")} value={audit.audit_readiness_score} />
            <Kpi label={t("kpi.vendorCompliance")} value={audit.vendor_compliance_rate} />
            <div className="bg-surface rounded-lg p-4">
              <p className="text-xs text-neutral">{t("kpi.docsVerified")}</p>
              <p className="text-2xl font-semibold text-gray-800">
                {audit.documents_verified}/{audit.documents_total}
              </p>
            </div>
            <Kpi label={t("kpi.pendingApprovals")} value={audit.pending_approvals} suffix="" invert />
            <Kpi label={t("kpi.openDisputes")} value={audit.open_disputes} suffix="" invert />
          </div>
        )}
      </Card>

      <Card title={t("card.expiringCerts")}>
        {certVendors.length === 0 ? (
          <p className="text-sm text-success-text">{t("empty.noCerts")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {certVendors.map((v) => (
              <li key={v.vendor_id} className="flex justify-between items-center">
                <span className="text-gray-700">
                  {v.name} — {v.certification_name}
                </span>
                <span className="text-warning-text font-medium">
                  {day(v.certification_expiry)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("card.envLogs")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral">
              <th scope="col" className="py-1 font-medium">{t("th.type")}</th>
              <th scope="col" className="font-medium">{t("th.reading")}</th>
              <th scope="col" className="font-medium">{t("th.date")}</th>
            </tr>
          </thead>
          <tbody>
            {(data.environment || []).slice(0, 5).map((e) => (
              <tr key={e.env_log_id} className="border-t border-gray-100">
                <td className="py-2">{e.log_type}</td>
                <td>
                  {e.reading} {e.unit}
                </td>
                <td>{day(e.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={t("card.labour")} wide>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral">
              <th scope="col" className="py-1 font-medium">{t("th.type")}</th>
              <th scope="col" className="font-medium">{t("th.period")}</th>
              <th scope="col" className="font-medium">{t("th.workers")}</th>
              <th scope="col" className="font-medium">{t("th.status")}</th>
            </tr>
          </thead>
          <tbody>
            {(data.labour || []).map((l) => (
              <tr key={l.labour_id} className="border-t border-gray-100">
                <td className="py-2">{l.filing_type}</td>
                <td>{l.period}</td>
                <td>{l.worker_count}</td>
                <td><StatusPill value={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------- Project Manager / Admin ----------
export function PMHome({ data, alerts, mutate, canApprove }) {
  const { t } = useI18n();
  const k = data.kpis;
  const audit = data.audit;
  const pendingSteps = (data.steps || []).filter((s) => s.status === "PENDING");
  const safety = data.safety || [];
  const siteBars = [...new Map(safety.map((s) => [s.site_name || "—", s])).values()].map(
    (s) => ({ label: (s.site_name || "—").slice(0, 8), value: s.ppe_compliance || 0 })
  );

  return (
    <>
      <Card title={t("card.portfolio")} wide>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label={t("kpi.activeContracts")} value={(data.contracts || []).length} suffix="" />
          <Kpi
            label={t("kpi.readiness")}
            value={audit ? audit.audit_readiness_score : k ? k.audit_readiness_score : 0}
          />
          <Kpi label={t("kpi.safetyCompletion")} value={k ? k.safety_audit_completion : 0} />
          <Kpi
            label={t("kpi.openDisputes")}
            value={(data.disputes || []).filter((d) => d.status !== "RESOLVED").length}
            suffix=""
            invert
          />
          <Kpi label={t("kpi.overdue")} value={k ? k.overdue_payments : 0} suffix="" invert />
        </div>
      </Card>

      <Card title={t("card.criticalAlerts")} wide>
        <AlertsFeed alerts={alerts} compact />
      </Card>

      <ProjectMap sites={data.sites} />

      <Card title={t("card.dprActivity")}>
        <BarChart data={dprTrend(data.dprs)} />
      </Card>

      <Card title={t("card.ppeBySite")}>
        <BarChart data={siteBars} color="#10B981" />
      </Card>

      <Card title={t("card.projectSites")}>
        <SiteBoard safety={safety} />
      </Card>

      <Card title={t("card.pendingApprovals")}>
        {pendingSteps.length === 0 ? (
          <p className="text-sm text-success-text">{t("empty.noApprovals")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pendingSteps.map((s) => (
              <li key={s.step_id} className="flex items-center justify-between">
                <span className="text-gray-700">{s.name}</span>
                {canApprove ? (
                  <Button
                    variant="primary"
                    onClick={() =>
                      mutate(
                        `mutation($t:ID!,$id:ID!){approveWorkflowStep(tenant_id:$t,step_id:$id){step_id}}`,
                        { id: s.step_id }
                      )
                    }
                  >
                    {t("btn.approve")}
                  </Button>
                ) : (
                  <StatusPill value={s.status} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
