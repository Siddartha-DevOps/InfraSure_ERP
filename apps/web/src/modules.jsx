// Module screens (per-domain views), shared across roles via the sidebar.
import { Card, Kpi, StatusPill, Button } from "./ui.jsx";
import { API_ORIGIN } from "./api.js";
import { useI18n } from "./i18n.jsx";

const day = (iso) => (iso || "").slice(0, 10);
const daysUntil = (iso) =>
  iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : Infinity;

export function ComplianceModule({ data }) {
  const { t } = useI18n();
  const k = data.kpis;
  return (
    <Card title={t("card.complianceKpis")} wide>
      {!k ? (
        <p className="text-sm text-neutral">{t("empty.noKpi")}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={t("kpi.gst")} value={k.gst_filing_compliance} />
          <Kpi label={t("kpi.tds")} value={k.tds_filing_compliance} />
          <Kpi label={t("kpi.ra")} value={k.ra_bill_approval_rate} />
          <Kpi label={t("kpi.safetyAuditsDone")} value={k.safety_audit_completion} />
          <Kpi label={t("kpi.avgPpe")} value={k.avg_ppe_compliance} />
          <Kpi label={t("kpi.pfEsi")} value={k.pf_esi_filing_rate} />
          <Kpi label={t("kpi.rera")} value={k.rera_filing_rate} />
          <Kpi label={t("kpi.overdue")} value={k.overdue_payments} suffix="" invert />
          <Kpi label={t("kpi.readiness")} value={k.audit_readiness_score} />
        </div>
      )}
    </Card>
  );
}

export function AuditModule({ data }) {
  const { t } = useI18n();
  const a = data.audit;
  return (
    <Card title={t("card.auditReadiness")} wide>
      {!a ? (
        <p className="text-sm text-neutral">{t("empty.noAudit")}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label={t("kpi.readiness")} value={a.audit_readiness_score} />
          <Kpi label={t("kpi.vendorCompliance")} value={a.vendor_compliance_rate} />
          <div className="bg-surface rounded-lg p-4">
            <p className="text-xs text-neutral">{t("kpi.docsVerified")}</p>
            <p className="text-2xl font-semibold text-gray-800">
              {a.documents_verified}/{a.documents_total}
            </p>
          </div>
          <Kpi label={t("kpi.pendingApprovals")} value={a.pending_approvals} suffix="" invert />
          <Kpi label={t("kpi.openDisputes")} value={a.open_disputes} suffix="" invert />
        </div>
      )}
    </Card>
  );
}

export function AIModule({ data }) {
  const { t } = useI18n();
  const ai = data.ai;
  return (
    <Card title={t("card.aiInsights")} wide>
      {!ai ? (
        <p className="text-sm text-neutral">{t("empty.noInsights")}</p>
      ) : !ai.available ? (
        <p className="text-sm text-warning-text">{t("misc.aiOffline")}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Kpi label={t("kpi.predictiveScore")} value={ai.predictive_score ?? 0} />
            <div className="bg-surface rounded-lg p-4">
              <p className="text-xs text-neutral">{t("kpi.riskLevel")}</p>
              <p
                className={`text-2xl font-semibold ${
                  ai.risk_level === "LOW"
                    ? "text-success"
                    : ai.risk_level === "MEDIUM"
                    ? "text-warning"
                    : "text-danger"
                }`}
              >
                {ai.risk_level}
              </p>
            </div>
            <Kpi label={t("kpi.anomalies")} value={ai.anomalies.length} suffix="" invert />
          </div>
          {ai.weak_factors.length > 0 && (
            <p className="text-sm text-gray-700">
              {t("misc.weakFactors")}: {ai.weak_factors.join(", ")}
            </p>
          )}
          {ai.anomalies.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral">
                  <th scope="col" className="py-1 font-medium">{t("th.type")}</th>
                  <th scope="col" className="font-medium">{t("th.severity")}</th>
                  <th scope="col" className="font-medium">{t("th.detail")}</th>
                </tr>
              </thead>
              <tbody>
                {ai.anomalies.map((a, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2">{a.type}</td>
                    <td
                      className={
                        a.severity === "HIGH"
                          ? "text-danger font-medium"
                          : "text-warning font-medium"
                      }
                    >
                      {a.severity}
                    </td>
                    <td className="text-gray-700">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}

export function ContractsModule({ data, canUpload, handleUpload }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.contracts")} wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.title")}</th>
            <th scope="col" className="font-medium">{t("th.ctype")}</th>
            <th scope="col" className="font-medium">{t("th.status")}</th>
            <th scope="col" className="font-medium">{t("th.expiry")}</th>
            <th scope="col" className="font-medium">{t("th.document")}</th>
          </tr>
        </thead>
        <tbody>
          {(data.contracts || []).map((c) => {
            const d = daysUntil(c.expiry_date);
            const soon = d <= 30;
            return (
              <tr key={c.contract_id} className="border-t border-gray-100 align-middle">
                <td className="py-2">{c.title}</td>
                <td className="text-gray-600">{t(`ctype.${c.contract_type}`)}</td>
                <td><StatusPill value={c.status} /></td>
                <td className={soon ? "text-warning-text font-medium" : ""}>
                  {day(c.expiry_date)}
                  {soon && (
                    <span className="ml-1 text-xs">
                      {d < 0 ? `(${t("misc.expired")})` : `(${d}d)`}
                    </span>
                  )}
                </td>
                <td>
                  {c.document_url ? (
                    <a
                      href={`${API_ORIGIN}${c.document_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {t("btn.view")}
                    </a>
                  ) : canUpload ? (
                    <label className="text-neutral cursor-pointer underline">
                      {t("btn.upload")}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleUpload(c.contract_id, e.target.files[0])}
                      />
                    </label>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export function SafetyModule({ data }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.safetyModule")} wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.site")}</th>
            <th scope="col" className="font-medium">{t("th.auditDate")}</th>
            <th scope="col" className="font-medium">{t("th.status")}</th>
            <th scope="col" className="font-medium">{t("th.ppe")}</th>
          </tr>
        </thead>
        <tbody>
          {(data.safety || []).map((s) => (
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
  );
}

export function EnvironmentModule({ data }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.envModule")} wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.type")}</th>
            <th scope="col" className="font-medium">{t("th.reading")}</th>
            <th scope="col" className="font-medium">{t("th.recorded")}</th>
            <th scope="col" className="font-medium">{t("th.notes")}</th>
          </tr>
        </thead>
        <tbody>
          {(data.environment || []).map((e) => (
            <tr key={e.env_log_id} className="border-t border-gray-100">
              <td className="py-2">{e.log_type}</td>
              <td>
                {e.reading} {e.unit}
              </td>
              <td>{day(e.recorded_at)}</td>
              <td className="text-neutral">{e.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function LabourModule({ data, canAct, mutate }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.labourModule")} wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.type")}</th>
            <th scope="col" className="font-medium">{t("th.period")}</th>
            <th scope="col" className="font-medium">{t("th.workers")}</th>
            <th scope="col" className="font-medium">{t("th.amount")}</th>
            <th scope="col" className="font-medium">{t("th.status")}</th>
            {canAct && <th></th>}
          </tr>
        </thead>
        <tbody>
          {(data.labour || []).map((l) => (
            <tr key={l.labour_id} className="border-t border-gray-100">
              <td className="py-2">{l.filing_type}</td>
              <td>{l.period}</td>
              <td>{l.worker_count}</td>
              <td>₹{Number(l.amount).toLocaleString("en-IN")}</td>
              <td><StatusPill value={l.status} /></td>
              {canAct && (
                <td className="space-x-3 whitespace-nowrap">
                  {(l.filing_type === "PF" || l.filing_type === "ESI") && l.status !== "FILED" && (
                    <button
                      onClick={() =>
                        mutate(
                          `mutation($t:ID!,$id:ID!){fileEPFOReturn(tenant_id:$t,labour_id:$id){status detail driver reference}}`,
                          { id: l.labour_id }
                        )
                      }
                      className="text-primary underline text-xs"
                    >
                      {t("btn.efileEpfo")}
                    </button>
                  )}
                  {l.status !== "FILED" && (
                    <button
                      onClick={() =>
                        mutate(
                          `mutation($t:ID!,$id:ID!){updateLabourFilingStatus(tenant_id:$t,labour_id:$id,status:"FILED"){labour_id}}`,
                          { id: l.labour_id }
                        )
                      }
                      className="text-primary underline text-xs"
                    >
                      {t("btn.markFiled")}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function ReraModule({ data, canAct, mutate }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.reraModule")} wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.project")}</th>
            <th scope="col" className="font-medium">{t("th.type")}</th>
            <th scope="col" className="font-medium">{t("th.due")}</th>
            <th scope="col" className="font-medium">{t("th.status")}</th>
            {canAct && <th></th>}
          </tr>
        </thead>
        <tbody>
          {(data.rera || []).map((r) => {
            const overdue = r.status === "PENDING" && daysUntil(r.due_date) < 0;
            return (
              <tr key={r.filing_id} className="border-t border-gray-100">
                <td className="py-2">{r.project_name}</td>
                <td>{r.filing_type}</td>
                <td className={overdue ? "text-danger-text font-medium" : ""}>
                  {day(r.due_date)}
                </td>
                <td><StatusPill value={r.status} /></td>
                {canAct && (
                  <td>
                    {r.status === "PENDING" && (
                      <button
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){updateReraFilingStatus(tenant_id:$t,filing_id:$id,status:"FILED"){filing_id}}`,
                            { id: r.filing_id }
                          )
                        }
                        className="text-primary underline text-xs"
                      >
                        {t("btn.markFiled")}
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
  );
}

export function VendorsModule({ data, canAct, mutate }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.vendorsModule")} wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.vendor")}</th>
            <th scope="col" className="font-medium">{t("th.certification")}</th>
            <th scope="col" className="font-medium">{t("th.certExpiry")}</th>
            <th scope="col" className="font-medium">{t("th.status")}</th>
            {canAct && <th></th>}
          </tr>
        </thead>
        <tbody>
          {(data.vendors || []).map((v) => {
            const d = daysUntil(v.certification_expiry);
            const soon = v.certification_expiry && d <= 30;
            return (
              <tr key={v.vendor_id} className="border-t border-gray-100">
                <td className="py-2">{v.name}</td>
                <td>{v.certification_name || "—"}</td>
                <td className={soon ? "text-warning-text font-medium" : ""}>
                  {v.certification_expiry
                    ? `${day(v.certification_expiry)}${
                        soon ? (d < 0 ? ` (${t("misc.expired")})` : ` (${d}d)`) : ""
                      }`
                    : "—"}
                </td>
                <td><StatusPill value={v.status} /></td>
                {canAct && (
                  <td>
                    <button
                      onClick={() =>
                        mutate(
                          `mutation($t:ID!,$id:ID!,$s:String!){updateVendorStatus(tenant_id:$t,vendor_id:$id,status:$s){vendor_id}}`,
                          {
                            id: v.vendor_id,
                            s: v.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                          }
                        )
                      }
                      className="text-primary underline text-xs"
                    >
                      {v.status === "ACTIVE" ? t("btn.suspend") : t("btn.reactivate")}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export function DisputesModule({ data, canAct, mutate }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.disputesModule")} wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.title")}</th>
            <th scope="col" className="font-medium">{t("th.type")}</th>
            <th scope="col" className="font-medium">{t("th.counterparty")}</th>
            <th scope="col" className="font-medium">{t("th.amount")}</th>
            <th scope="col" className="font-medium">{t("th.status")}</th>
            <th scope="col" className="font-medium">{t("th.esc")}</th>
            {canAct && <th></th>}
          </tr>
        </thead>
        <tbody>
          {(data.disputes || []).map((d) => (
            <tr key={d.dispute_id} className="border-t border-gray-100">
              <td className="py-2">{d.title}</td>
              <td>{d.dispute_type}</td>
              <td>{d.counterparty || "—"}</td>
              <td>₹{Number(d.amount).toLocaleString("en-IN")}</td>
              <td><StatusPill value={d.status} /></td>
              <td>{d.escalation_level}</td>
              {canAct && (
                <td className="space-x-2 whitespace-nowrap">
                  {d.status !== "RESOLVED" && (
                    <>
                      <button
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){escalateDispute(tenant_id:$t,dispute_id:$id){dispute_id}}`,
                            { id: d.dispute_id }
                          )
                        }
                        className="text-warning-text underline text-xs"
                      >
                        {t("btn.escalate")}
                      </button>
                      <button
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){updateDisputeStatus(tenant_id:$t,dispute_id:$id,status:"RESOLVED"){dispute_id}}`,
                            { id: d.dispute_id }
                          )
                        }
                        className="text-success-text underline text-xs"
                      >
                        {t("btn.resolve")}
                      </button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function BillingModule({ data, checkout, startCheckout, mutate }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.billingModule")} wide>
      <p className="text-sm text-gray-700 mb-4">
        {t("misc.currentPlan")}:{" "}
        <span className="font-semibold text-gray-800">
          {data.subscription?.plan_type || "—"}
        </span>{" "}
        · status {data.subscription?.status || "—"}
      </p>
      {checkout && (
        <p className="text-sm mb-4 bg-success-soft text-gray-800 rounded p-3">
          Checkout session created ({checkout.driver}):{" "}
          <a
            href={checkout.url}
            target="_blank"
            rel="noreferrer"
            className="underline break-all text-primary"
          >
            {checkout.url}
          </a>
        </p>
      )}
      <div className="grid md:grid-cols-3 gap-4">
        {(data.tiers || []).map((tier) => {
          const current = data.subscription?.plan_type === tier.code;
          return (
            <div
              key={tier.code}
              className={`rounded-lg border p-4 ${
                current ? "border-primary" : "border-gray-200"
              }`}
            >
              <h4 className="font-semibold text-gray-800">{tier.name}</h4>
              <p className="text-2xl font-semibold text-gray-800 my-1">
                ₹{tier.price_inr.toLocaleString("en-IN")}
                <span className="text-xs font-normal text-neutral">{t("misc.perMonth")}</span>
              </p>
              <ul className="text-xs text-neutral space-y-1 mb-3">
                {tier.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              {current ? (
                <span className="text-xs text-success-text font-medium">{t("misc.currentPlan")}</span>
              ) : (
                <div className="space-x-3">
                  <button
                    onClick={() =>
                      mutate(
                        `mutation($t:ID!,$p:String!){changeSubscriptionPlan(tenant_id:$t,plan_type:$p){plan_type}}`,
                        { p: tier.code }
                      )
                    }
                    className="text-primary underline text-xs"
                  >
                    {t("btn.switch")}
                  </button>
                  <button
                    onClick={() => startCheckout(tier.code)}
                    className="text-neutral underline text-xs"
                  >
                    {t("btn.checkout")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function IntegrationsModule({ data, integrationMsg, runIntegration }) {
  const { t } = useI18n();
  return (
    <Card title={t("card.integrationsModule")} wide>
      {integrationMsg && (
        <p className="text-sm mb-4 bg-surface text-gray-700 rounded p-3">
          {integrationMsg}
        </p>
      )}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-neutral">
            <th scope="col" className="py-1 font-medium">{t("th.integration")}</th>
            <th scope="col" className="font-medium">{t("th.driver")}</th>
            <th scope="col" className="font-medium">{t("th.configured")}</th>
          </tr>
        </thead>
        <tbody>
          {(data.integrations || []).map((i) => (
            <tr key={i.integration} className="border-t border-gray-100">
              <td className="py-2">{i.integration}</td>
              <td>{i.driver}</td>
              <td>
                {i.configured ? (
                  <span className="text-success-text">live</span>
                ) : (
                  <span className="text-warning-text">stub</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => runIntegration("syncTallyLedger")}>Sync Tally/SAP</Button>
        <Button onClick={() => runIntegration("syncReraUpdates")}>
          Sync RERA updates
        </Button>
        <Button onClick={() => runIntegration("importBimModel")}>
          Import BIM model
        </Button>
      </div>
      <p className="text-xs text-neutral mt-3">
        GST e-filing and Aadhaar e-Sign run per-record from the Finance and Contracts
        screens.
      </p>
    </Card>
  );
}
