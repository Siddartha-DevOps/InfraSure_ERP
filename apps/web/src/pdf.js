// Client-side "Compliance Pack" PDF export — no dependencies.
// Builds a print-optimized HTML document in a new window and invokes the
// browser's print dialog (Save as PDF). Supports the audit retrieval-time story:
// a one-click, printable evidence pack of readiness + registers.

const esc = (v) =>
  v === null || v === undefined
    ? ""
    : String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const day = (iso) => (iso || "").slice(0, 10);

// Renders one table section; returns "" when there are no rows so empty
// domains are omitted from the pack rather than printing a blank table.
function section(title, rows, columns) {
  if (!rows?.length) return "";
  const head = columns.map((c) => `<th>${esc(c.header)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${esc(c.value(r))}</td>`).join("")}</tr>`
    )
    .join("");
  return `
    <section>
      <h2>${esc(title)}</h2>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </section>`;
}

// Builds the full HTML document for the pack. Exported for testing.
export function buildCompliancePackHtml(data, meta = {}) {
  const t = meta.t || ((k) => k);
  const company = meta.company || "—";
  const generated = new Date().toLocaleString("en-IN");
  const a = data.audit;
  const trend = data.readinessTrend || [];
  const k = data.kpis;

  const readinessBlock = a
    ? `
    <section class="cards">
      <div class="card"><span class="big">${a.audit_readiness_score}</span><span class="lbl">${esc(t("kpi.readiness"))}</span></div>
      <div class="card"><span class="big">${a.documents_verified}/${a.documents_total}</span><span class="lbl">${esc(t("kpi.docsVerified"))}</span></div>
      <div class="card"><span class="big">${a.pending_approvals}</span><span class="lbl">${esc(t("appr.title"))}</span></div>
      <div class="card"><span class="big">${a.open_disputes}</span><span class="lbl">${esc(t("nav.disputes"))}</span></div>
      <div class="card"><span class="big">${a.vendor_compliance_rate}%</span><span class="lbl">${esc(t("kpi.vendorCompliance"))}</span></div>
    </section>`
    : "";

  const trendBlock = section(
    t("rep.readinessTrend"),
    trend,
    [
      { header: t("th.period"), value: (r) => (r.captured_at || "").slice(0, 7) },
      { header: t("kpi.readiness"), value: (r) => r.score },
    ]
  );

  const kpiBlock = k
    ? section(t("pdf.kpis"), [k], [
        { header: t("kpi.gst"), value: (r) => `${r.gst_filing_compliance}%` },
        { header: t("kpi.tds"), value: (r) => `${r.tds_filing_compliance}%` },
        { header: t("kpi.ra"), value: (r) => `${r.ra_bill_approval_rate}%` },
        { header: t("kpi.safetyAuditsDone"), value: (r) => `${r.safety_audit_completion}%` },
        { header: t("kpi.readiness"), value: (r) => `${r.audit_readiness_score}%` },
      ])
    : "";

  const contracts = section(t("nav.contracts"), data.contracts || [], [
    { header: t("th.title"), value: (r) => r.title },
    { header: t("th.ctype"), value: (r) => t(`ctype.${r.contract_type}`) },
    { header: t("th.status"), value: (r) => t(`status.${r.status}`) },
    { header: t("th.expiry"), value: (r) => day(r.expiry_date) },
  ]);

  const clearances = section(t("nav.clearances"), data.clearances || [], [
    { header: t("cl.th.type"), value: (r) => t(`cl.type.${r.clearance_type}`) },
    { header: t("cl.th.authority"), value: (r) => r.authority || "—" },
    { header: t("cl.th.reference"), value: (r) => r.reference_no || "—" },
    { header: t("cl.th.expiry"), value: (r) => day(r.expiry_date) },
    { header: t("cl.th.renewal"), value: (r) => t(`cl.${(r.renewal_status || "").toLowerCase()}`) },
  ]);

  const incidents = section(t("nav.incidents"), data.incidents || [], [
    { header: t("inc.th.date"), value: (r) => day(r.occurred_at) },
    { header: t("inc.th.title"), value: (r) => r.title },
    { header: t("inc.th.category"), value: (r) => t(`inc.cat.${r.category}`) },
    { header: t("inc.th.severity"), value: (r) => t(`inc.sev.${r.severity}`) },
    { header: t("inc.th.status"), value: (r) => t(`status.${r.status}`) },
  ]);

  const finance = section(t("nav.finance"), data.finance || [], [
    { header: t("th.invoice"), value: (r) => r.invoice_number || r.finance_id },
    { header: t("th.amount"), value: (r) => `₹${Number(r.amount || 0).toLocaleString("en-IN")}` },
    { header: "GST", value: (r) => t(`status.${r.gst_filing_status}`) },
    { header: t("th.due"), value: (r) => day(r.due_date) },
  ]);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(t("pdf.title"))} — ${esc(company)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Inter, sans-serif; color: #111827; margin: 32px; }
  header { border-bottom: 3px solid #1E3A8A; padding-bottom: 12px; margin-bottom: 20px; }
  header h1 { color: #1E3A8A; margin: 0 0 4px; font-size: 20px; }
  header .meta { color: #6B7280; font-size: 12px; }
  h2 { font-size: 14px; color: #1E3A8A; margin: 22px 0 8px; }
  section { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #E5E7EB; }
  th { background: #F3F4F6; color: #374151; font-weight: 600; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; text-align: center; min-width: 110px; }
  .card .big { display: block; font-size: 22px; font-weight: 700; color: #1E3A8A; }
  .card .lbl { font-size: 10px; color: #6B7280; }
  footer { margin-top: 28px; border-top: 1px solid #E5E7EB; padding-top: 8px; color: #9CA3AF; font-size: 10px; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <header>
    <h1>${esc(t("pdf.title"))}</h1>
    <div class="meta">${esc(company)} · ${esc(t("pdf.generated"))}: ${esc(generated)}</div>
  </header>
  ${readinessBlock ? `<h2>${esc(t("rep.readiness"))}</h2>${readinessBlock}` : ""}
  ${trendBlock}
  ${kpiBlock}
  ${contracts}
  ${clearances}
  ${incidents}
  ${finance}
  <footer>${esc(t("pdf.footer"))}</footer>
</body></html>`;
}

// Opens the pack in a new window and triggers the print dialog (Save as PDF).
export function openCompliancePack(data, meta = {}) {
  const html = buildCompliancePackHtml(data, meta);
  const w = window.open("", "_blank");
  if (!w) return false; // popup blocked
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Defer print until the new document has laid out.
  w.onload = () => {
    w.focus();
    w.print();
  };
  return true;
}
