// Builds the consolidated, severity-sorted alerts feed from loaded dashboard data.
// Pass the i18n t(key, vars) so alert sentences localize with the active language.
const daysUntil = (iso) =>
  iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : Infinity;

export function buildAlerts(data, t = (k) => k) {
  const alerts = [];

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
      alerts.push({
        severity: "critical",
        text: t("alert.invoiceOverdue", {
          invoice: f.invoice_number || f.finance_id,
          amount: Number(f.amount).toLocaleString("en-IN"),
        }),
        module: t("nav.finance"),
      });
    }
  }

  for (const r of data.rera || []) {
    if (r.status === "PENDING" && daysUntil(r.due_date) < 0) {
      alerts.push({
        severity: "critical",
        text: t("alert.reraOverdue", { project: r.project_name }),
        module: t("nav.rera"),
      });
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
      text: a.detail, // AI engine output (English; localizable in a later pass)
      module: t("nav.ai"),
    });
  }

  for (const d of data.disputes || []) {
    if (d.status === "ESCALATED") {
      alerts.push({
        severity: "critical",
        text: t("alert.disputeEscalated", { title: d.title }),
        module: t("nav.disputes"),
      });
    } else if (d.status !== "RESOLVED") {
      alerts.push({
        severity: "warning",
        text: t("alert.disputeOpen", { title: d.title }),
        module: t("nav.disputes"),
      });
    }
  }

  for (const l of data.labour || []) {
    if (l.status === "PENDING") {
      alerts.push({
        severity: "warning",
        text: t("alert.labourPending", { type: l.filing_type, period: l.period }),
        module: t("nav.labour"),
      });
    }
  }

  const rank = { critical: 0, warning: 1, ok: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
