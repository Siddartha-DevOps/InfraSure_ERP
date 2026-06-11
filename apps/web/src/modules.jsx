// Module screens (per-domain views), shared across roles via the sidebar.
import { Card, Kpi, StatusPill, Button } from "./ui.jsx";
import { API_ORIGIN } from "./api.js";

const day = (iso) => (iso || "").slice(0, 10);
const daysUntil = (iso) =>
  iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : Infinity;

export function ComplianceModule({ data }) {
  const k = data.kpis;
  return (
    <Card title="Compliance KPIs" wide>
      {!k ? (
        <p className="text-sm text-neutral">No KPI data.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="GST filing" value={k.gst_filing_compliance} />
          <Kpi label="TDS filing" value={k.tds_filing_compliance} />
          <Kpi label="RA bill approval" value={k.ra_bill_approval_rate} />
          <Kpi label="Safety audits done" value={k.safety_audit_completion} />
          <Kpi label="Avg PPE compliance" value={k.avg_ppe_compliance} />
          <Kpi label="PF/ESI filing" value={k.pf_esi_filing_rate} />
          <Kpi label="RERA filing" value={k.rera_filing_rate} />
          <Kpi label="Overdue payments" value={k.overdue_payments} suffix="" invert />
          <Kpi label="Audit readiness" value={k.audit_readiness_score} />
        </div>
      )}
    </Card>
  );
}

export function AuditModule({ data }) {
  const a = data.audit;
  return (
    <Card title="Audit Readiness" wide>
      {!a ? (
        <p className="text-sm text-neutral">No audit data.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Audit readiness" value={a.audit_readiness_score} />
          <Kpi label="Vendor compliance" value={a.vendor_compliance_rate} />
          <div className="bg-surface rounded-lg p-4">
            <p className="text-xs text-neutral">Documents verified</p>
            <p className="text-2xl font-semibold text-gray-800">
              {a.documents_verified}/{a.documents_total}
            </p>
          </div>
          <Kpi label="Pending approvals" value={a.pending_approvals} suffix="" invert />
          <Kpi label="Open disputes" value={a.open_disputes} suffix="" invert />
        </div>
      )}
    </Card>
  );
}

export function AIModule({ data }) {
  const ai = data.ai;
  return (
    <Card title="AI Compliance Insights" wide>
      {!ai ? (
        <p className="text-sm text-neutral">No insights.</p>
      ) : !ai.available ? (
        <p className="text-sm text-warning">
          AI engine is offline — insights unavailable. Start the
          <code className="mx-1 bg-surface px-1 rounded">ai-engine</code>
          service to enable predictive scoring and anomaly detection.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Kpi label="Predictive score" value={ai.predictive_score ?? 0} />
            <div className="bg-surface rounded-lg p-4">
              <p className="text-xs text-neutral">Risk level</p>
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
            <Kpi label="Anomalies" value={ai.anomalies.length} suffix="" invert />
          </div>
          {ai.weak_factors.length > 0 && (
            <p className="text-sm text-gray-700">
              Weak factors: {ai.weak_factors.join(", ")}
            </p>
          )}
          {ai.anomalies.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral">
                  <th className="py-1 font-medium">Type</th>
                  <th className="font-medium">Severity</th>
                  <th className="font-medium">Detail</th>
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
  return (
    <Card title="Contracts" wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Title</th>
            <th className="font-medium">Status</th>
            <th className="font-medium">Expiry</th>
            <th className="font-medium">Document</th>
          </tr>
        </thead>
        <tbody>
          {(data.contracts || []).map((c) => {
            const d = daysUntil(c.expiry_date);
            const soon = d <= 30;
            return (
              <tr key={c.contract_id} className="border-t border-gray-100 align-middle">
                <td className="py-2">{c.title}</td>
                <td><StatusPill value={c.status} /></td>
                <td className={soon ? "text-warning font-medium" : ""}>
                  {day(c.expiry_date)}
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
                      className="text-primary underline"
                    >
                      view
                    </a>
                  ) : canUpload ? (
                    <label className="text-neutral cursor-pointer underline">
                      upload
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
  return (
    <Card title="Safety Audits" wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Site</th>
            <th className="font-medium">Audit date</th>
            <th className="font-medium">Status</th>
            <th className="font-medium">PPE %</th>
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
                    ? "text-success font-medium"
                    : s.ppe_compliance >= 60
                    ? "text-warning font-medium"
                    : "text-danger font-medium"
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
  return (
    <Card title="Environmental Logs (pollution / waste)" wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Type</th>
            <th className="font-medium">Reading</th>
            <th className="font-medium">Recorded</th>
            <th className="font-medium">Notes</th>
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
  return (
    <Card title="Labour Compliance (PF / ESI / Wage)" wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Type</th>
            <th className="font-medium">Period</th>
            <th className="font-medium">Workers</th>
            <th className="font-medium">Amount</th>
            <th className="font-medium">Status</th>
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
                <td>
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
  );
}

export function ReraModule({ data, canAct, mutate }) {
  return (
    <Card title="RERA Filings" wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Project</th>
            <th className="font-medium">Type</th>
            <th className="font-medium">Due</th>
            <th className="font-medium">Status</th>
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
                <td className={overdue ? "text-danger font-medium" : ""}>
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
  );
}

export function VendorsModule({ data, canAct, mutate }) {
  return (
    <Card title="Vendor / Subcontractor Registry" wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Vendor</th>
            <th className="font-medium">Certification</th>
            <th className="font-medium">Cert. expiry</th>
            <th className="font-medium">Status</th>
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
                <td className={soon ? "text-warning font-medium" : ""}>
                  {v.certification_expiry
                    ? `${day(v.certification_expiry)}${
                        soon ? (d < 0 ? " (expired)" : ` (${d}d)`) : ""
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
                      {v.status === "ACTIVE" ? "suspend" : "reactivate"}
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
  return (
    <Card title="Risk & Dispute Register" wide>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Title</th>
            <th className="font-medium">Type</th>
            <th className="font-medium">Counterparty</th>
            <th className="font-medium">Amount</th>
            <th className="font-medium">Status</th>
            <th className="font-medium">Esc.</th>
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
                        className="text-warning underline text-xs"
                      >
                        escalate
                      </button>
                      <button
                        onClick={() =>
                          mutate(
                            `mutation($t:ID!,$id:ID!){updateDisputeStatus(tenant_id:$t,dispute_id:$id,status:"RESOLVED"){dispute_id}}`,
                            { id: d.dispute_id }
                          )
                        }
                        className="text-success underline text-xs"
                      >
                        resolve
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
  return (
    <Card title="Billing & Subscription" wide>
      <p className="text-sm text-gray-700 mb-4">
        Current plan:{" "}
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
                <span className="text-xs font-normal text-neutral">/mo</span>
              </p>
              <ul className="text-xs text-neutral space-y-1 mb-3">
                {tier.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              {current ? (
                <span className="text-xs text-success font-medium">Current plan</span>
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
                    switch
                  </button>
                  <button
                    onClick={() => startCheckout(tier.code)}
                    className="text-neutral underline text-xs"
                  >
                    checkout
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
  return (
    <Card title="External Integrations" wide>
      {integrationMsg && (
        <p className="text-sm mb-4 bg-surface text-gray-700 rounded p-3">
          {integrationMsg}
        </p>
      )}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-neutral">
            <th className="py-1 font-medium">Integration</th>
            <th className="font-medium">Driver</th>
            <th className="font-medium">Configured</th>
          </tr>
        </thead>
        <tbody>
          {(data.integrations || []).map((i) => (
            <tr key={i.integration} className="border-t border-gray-100">
              <td className="py-2">{i.integration}</td>
              <td>{i.driver}</td>
              <td>
                {i.configured ? (
                  <span className="text-success">live</span>
                ) : (
                  <span className="text-warning">stub</span>
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
