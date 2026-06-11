// Builds the consolidated, severity-sorted alerts feed from loaded dashboard data.
const daysUntil = (iso) =>
  iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : Infinity;

export function buildAlerts(data) {
  const alerts = [];

  for (const c of data.expiring || []) {
    const d = daysUntil(c.expiry_date);
    alerts.push({
      severity: d < 0 ? "critical" : "warning",
      text:
        d < 0
          ? `Contract "${c.title}" expired ${-d}d ago`
          : `Contract "${c.title}" expires in ${d}d`,
      module: "Contracts",
    });
  }

  for (const f of data.finance || []) {
    if (!f.paid_date && daysUntil(f.due_date) < 0) {
      alerts.push({
        severity: "critical",
        text: `Invoice ${f.invoice_number || f.finance_id} overdue (₹${Number(
          f.amount
        ).toLocaleString("en-IN")})`,
        module: "Finance",
      });
    }
  }

  for (const r of data.rera || []) {
    if (r.status === "PENDING" && daysUntil(r.due_date) < 0) {
      alerts.push({
        severity: "critical",
        text: `RERA filing overdue — ${r.project_name}`,
        module: "RERA",
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
            ? `${v.name} certification expired`
            : `${v.name} certification expires in ${d}d`,
        module: "Vendors",
      });
    }
  }

  for (const a of data.ai?.anomalies || []) {
    alerts.push({
      severity: a.severity === "HIGH" ? "critical" : "warning",
      text: a.detail,
      module: "AI",
    });
  }

  for (const d of data.disputes || []) {
    if (d.status === "ESCALATED") {
      alerts.push({
        severity: "critical",
        text: `Dispute escalated — ${d.title}`,
        module: "Disputes",
      });
    } else if (d.status !== "RESOLVED") {
      alerts.push({
        severity: "warning",
        text: `Open dispute — ${d.title}`,
        module: "Disputes",
      });
    }
  }

  for (const l of data.labour || []) {
    if (l.status === "PENDING") {
      alerts.push({
        severity: "warning",
        text: `${l.filing_type} filing pending for ${l.period}`,
        module: "Labour",
      });
    }
  }

  const rank = { critical: 0, warning: 1, ok: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
