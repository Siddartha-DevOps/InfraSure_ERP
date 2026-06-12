// Builds the consolidated, severity-sorted alerts feed from loaded dashboard data.
// Pass t(key, vars) to localize, and optionally (mutate, role) to attach role-gated
// inline actions (e.g. "File now") to actionable alerts.
const daysUntil = (iso) =>
  iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : Infinity;

const has = (role, roles) => roles.includes(role);

export function buildAlerts(data, t = (k) => k, mutate = null, role = null) {
  const alerts = [];
  const fileNow = t("appr.fileNow");

  for (const c of data.expiring || []) {
    const d = daysUntil(c.expiry_date);
    alerts.push({
      severity: d < 0 ? "critical" : "warning",
      text:
        d < 0
          ? t("alert.contractExpired", { title: c.title, days: -d })
          : t("alert.contractExpiring", { title: c.title, days: d }),
      module: t("nav.contracts"),
    });
  }

  for (const f of data.finance || []) {
    if (!f.paid_date && daysUntil(f.due_date) < 0) {
      const a = {
        severity: "critical",
        text: t("alert.invoiceOverdue", {
          invoice: f.invoice_number || f.finance_id,
          amount: Number(f.amount).toLocaleString("en-IN"),
        }),
        module: t("nav.finance"),
      };
      if (mutate && f.gst_filing_status !== "FILED" &&
          has(role, ["ACCOUNTANT", "ADMIN", "COMPANY_ADMIN"])) {
        a.actionLabel = fileNow;
        a.onAction = () =>
          mutate(`mutation($t:ID!,$id:ID!){fileGST(tenant_id:$t,finance_id:$id){finance_id}}`, { id: f.finance_id });
      }
      alerts.push(a);
    }
  }

  for (const r of data.rera || []) {
    if (r.status === "PENDING" && daysUntil(r.due_date) < 0) {
      const a = {
        severity: "critical",
        text: t("alert.reraOverdue", { project: r.project_name }),
        module: t("nav.rera"),
      };
      if (mutate && has(role, ["PROJECT_MANAGER", "COMPLIANCE_OFFICER", "ADMIN", "COMPANY_ADMIN"])) {
        a.actionLabel = fileNow;
        a.onAction = () =>
          mutate(`mutation($t:ID!,$id:ID!){updateReraFilingStatus(tenant_id:$t,filing_id:$id,status:"FILED"){filing_id}}`, { id: r.filing_id });
      }
      alerts.push(a);
    }
  }

  for (const v of data.vendors || []) {
    const d = daysUntil(v.certification_expiry);
    if (v.certification_expiry && d <= 30) {
      alerts.push({
        severity: d < 0 ? "critical" : "warning",
        text:
          d < 0
            ? t("alert.certExpired", { vendor: v.name })
            : t("alert.certExpiring", { vendor: v.name, days: d }),
        module: t("nav.vendors"),
      });
    }
  }

  for (const a of data.ai?.anomalies || []) {
    alerts.push({
      severity: a.severity === "HIGH" ? "critical" : "warning",
      text: a.detail,
      module: t("nav.ai"),
    });
  }

  for (const d of data.disputes || []) {
    if (d.status === "ESCALATED") {
      alerts.push({ severity: "critical", text: t("alert.disputeEscalated", { title: d.title }), module: t("nav.disputes") });
    } else if (d.status !== "RESOLVED") {
      alerts.push({ severity: "warning", text: t("alert.disputeOpen", { title: d.title }), module: t("nav.disputes") });
    }
  }

  for (const l of data.labour || []) {
    if (l.status === "PENDING") {
      const a = {
        severity: "warning",
        text: t("alert.labourPending", { type: l.filing_type, period: l.period }),
        module: t("nav.labour"),
      };
      if (mutate && has(role, ["ACCOUNTANT", "COMPLIANCE_OFFICER", "ADMIN", "COMPANY_ADMIN"])) {
        a.actionLabel = fileNow;
        a.onAction = () =>
          mutate(`mutation($t:ID!,$id:ID!){updateLabourFilingStatus(tenant_id:$t,labour_id:$id,status:"FILED"){labour_id}}`, { id: l.labour_id });
      }
      alerts.push(a);
    }
  }

  const rank = { critical: 0, warning: 1, ok: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
