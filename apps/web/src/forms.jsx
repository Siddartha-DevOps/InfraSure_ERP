// Quick-action modal forms: minimal fields + inline validation per the design spec.
import { useState } from "react";
import { gql } from "./api.js";
import { Modal, Field, Button, inputCls } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return { values, setValues, errors, setErrors, busy, setBusy, set };
}

export function NewDPRModal({ open, onClose, tenantId, onDone }) {
  const { t } = useI18n();
  const f = useForm({ report: "" });

  async function submit(e) {
    e.preventDefault();
    if (!f.values.report.trim())
      return f.setErrors({ report: t("err.reportRequired") });
    f.setBusy(true);
    try {
      await gql(
        `mutation($t:ID!,$d:String!){createDPR(tenant_id:$t,report_data:$d){dpr_id}}`,
        { t: tenantId, d: f.values.report.trim() }
      );
      f.setValues({ report: "" });
      f.setErrors({});
      onDone();
      onClose();
    } catch (err) {
      f.setErrors({ report: err.message });
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t("qa.newDPR")} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={t("form.progressNotes")} error={f.errors.report}>
          <textarea
            className={`${inputCls} h-28`}
            value={f.values.report}
            onChange={f.set("report")}
            placeholder="Work completed, blockers, manpower…"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? t("btn.saving") : t("btn.submitDpr")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SafetyAuditModal({ open, onClose, tenantId, onDone }) {
  const { t } = useI18n();
  const f = useForm({ site: "", status: "COMPLETED", ppe: "90" });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!f.values.site.trim()) errs.site = t("err.siteRequired");
    const ppe = Number(f.values.ppe);
    if (Number.isNaN(ppe) || ppe < 0 || ppe > 100)
      errs.ppe = t("err.ppeRange");
    if (Object.keys(errs).length) return f.setErrors(errs);

    f.setBusy(true);
    try {
      await gql(
        `mutation($t:ID!,$s:String!,$site:String,$p:Int){logSafetyAudit(tenant_id:$t,checklist_status:$s,site_name:$site,ppe_compliance:$p){safety_id}}`,
        { t: tenantId, s: f.values.status, site: f.values.site.trim(), p: ppe }
      );
      f.setErrors({});
      onDone();
      onClose();
    } catch (err) {
      f.setErrors({ site: err.message });
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t("qa.logSafety")} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={t("form.siteName")} error={f.errors.site}>
          <input
            className={inputCls}
            value={f.values.site}
            onChange={f.set("site")}
            placeholder="Site A — Pier Casting"
          />
        </Field>
        <Field label={t("form.checklistStatus")}>
          <select className={inputCls} value={f.values.status} onChange={f.set("status")}>
            <option value="COMPLETED">{t("form.optCompleted")}</option>
            <option value="PENDING">{t("form.optPending")}</option>
            <option value="FAILED">{t("form.optFailed")}</option>
          </select>
        </Field>
        <Field label={t("form.ppe")} error={f.errors.ppe}>
          <input
            type="number"
            min="0"
            max="100"
            className={inputCls}
            value={f.values.ppe}
            onChange={f.set("ppe")}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? t("btn.saving") : t("btn.logAudit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function FinanceModal({ open, onClose, tenantId, onDone }) {
  const { t } = useI18n();
  const f = useForm({ invoice: "", amount: "", due: "", period: "" });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    const amount = Number(f.values.amount);
    if (Number.isNaN(amount) || amount <= 0) errs.amount = t("err.amountPositive");
    if (!f.values.due) errs.due = t("err.dueRequired");
    if (Object.keys(errs).length) return f.setErrors(errs);

    f.setBusy(true);
    try {
      await gql(
        `mutation($t:ID!,$a:Float!,$d:String!,$inv:String,$p:String){createFinanceRecord(tenant_id:$t,amount:$a,due_date:$d,invoice_number:$inv,filing_period:$p){finance_id}}`,
        {
          t: tenantId,
          a: amount,
          d: f.values.due,
          inv: f.values.invoice || null,
          p: f.values.period || null,
        }
      );
      f.setErrors({});
      onDone();
      onClose();
    } catch (err) {
      f.setErrors({ amount: err.message });
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t("qa.newFinance")} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={t("form.invoiceNumber")}>
          <input
            className={inputCls}
            value={f.values.invoice}
            onChange={f.set("invoice")}
            placeholder="INV-2026-003"
          />
        </Field>
        <Field label={t("form.amount")} error={f.errors.amount}>
          <input
            type="number"
            className={inputCls}
            value={f.values.amount}
            onChange={f.set("amount")}
          />
        </Field>
        <Field label={t("form.dueDate")} error={f.errors.due}>
          <input
            type="date"
            className={inputCls}
            value={f.values.due}
            onChange={f.set("due")}
          />
        </Field>
        <Field label={t("form.filingPeriod")}>
          <input
            className={inputCls}
            value={f.values.period}
            onChange={f.set("period")}
            placeholder="2026-Q2"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? t("btn.saving") : t("btn.createRecord")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ContractModal({ open, onClose, tenantId, onDone }) {
  const { t } = useI18n();
  const f = useForm({ title: "", expiry: "", type: "AGREEMENT" });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!f.values.title.trim()) errs.title = t("err.titleRequired");
    if (!f.values.expiry) errs.expiry = t("err.expiryRequired");
    if (Object.keys(errs).length) return f.setErrors(errs);

    f.setBusy(true);
    try {
      await gql(
        `mutation($t:ID!,$title:String!,$e:String!,$ct:String){createContract(tenant_id:$t,title:$title,expiry_date:$e,contract_type:$ct){contract_id}}`,
        { t: tenantId, title: f.values.title.trim(), e: f.values.expiry, ct: f.values.type }
      );
      f.setErrors({});
      onDone();
      onClose();
    } catch (err) {
      f.setErrors({ title: err.message });
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t("qa.newContract")} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={t("form.title")} error={f.errors.title}>
          <input
            className={inputCls}
            value={f.values.title}
            onChange={f.set("title")}
            placeholder="Metro Line 3 — Civil Works"
          />
        </Field>
        <Field label={t("form.contractType")}>
          <select className={inputCls} value={f.values.type} onChange={f.set("type")}>
            <option value="AGREEMENT">{t("ctype.AGREEMENT")}</option>
            <option value="WORK_ORDER">{t("ctype.WORK_ORDER")}</option>
            <option value="INSURANCE">{t("ctype.INSURANCE")}</option>
            <option value="OTHER">{t("ctype.OTHER")}</option>
          </select>
        </Field>
        <Field label={t("form.expiryDate")} error={f.errors.expiry}>
          <input
            type="date"
            className={inputCls}
            value={f.values.expiry}
            onChange={f.set("expiry")}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? t("btn.saving") : t("btn.createContract")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function IncidentModal({ open, onClose, tenantId, onDone }) {
  const { t } = useI18n();
  const f = useForm({
    title: "",
    category: "OTHER",
    severity: "LOW",
    site: "",
    description: "",
  });

  async function submit(e) {
    e.preventDefault();
    if (!f.values.title.trim())
      return f.setErrors({ title: t("err.titleRequired") });
    f.setBusy(true);
    try {
      await gql(
        `mutation($t:ID!,$title:String!,$c:String,$s:String,$site:String,$d:String){logIncident(tenant_id:$t,title:$title,category:$c,severity:$s,site_name:$site,description:$d){incident_id}}`,
        {
          t: tenantId,
          title: f.values.title.trim(),
          c: f.values.category,
          s: f.values.severity,
          site: f.values.site || null,
          d: f.values.description || null,
        }
      );
      f.setValues({ title: "", category: "OTHER", severity: "LOW", site: "", description: "" });
      f.setErrors({});
      onDone();
      onClose();
    } catch (err) {
      f.setErrors({ title: err.message });
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t("qa.logIncident")} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={t("form.incidentTitle")} error={f.errors.title}>
          <input
            className={inputCls}
            value={f.values.title}
            onChange={f.set("title")}
            placeholder="Worker slip near pier formwork"
          />
        </Field>
        <Field label={t("form.incidentCategory")}>
          <select className={inputCls} value={f.values.category} onChange={f.set("category")}>
            <option value="INJURY">{t("inc.cat.INJURY")}</option>
            <option value="NEAR_MISS">{t("inc.cat.NEAR_MISS")}</option>
            <option value="PROPERTY_DAMAGE">{t("inc.cat.PROPERTY_DAMAGE")}</option>
            <option value="ENVIRONMENTAL">{t("inc.cat.ENVIRONMENTAL")}</option>
            <option value="OTHER">{t("inc.cat.OTHER")}</option>
          </select>
        </Field>
        <Field label={t("form.incidentSeverity")}>
          <select className={inputCls} value={f.values.severity} onChange={f.set("severity")}>
            <option value="LOW">{t("inc.sev.LOW")}</option>
            <option value="MEDIUM">{t("inc.sev.MEDIUM")}</option>
            <option value="HIGH">{t("inc.sev.HIGH")}</option>
            <option value="CRITICAL">{t("inc.sev.CRITICAL")}</option>
          </select>
        </Field>
        <Field label={t("form.siteName")}>
          <input
            className={inputCls}
            value={f.values.site}
            onChange={f.set("site")}
            placeholder="Site A — Pier Casting"
          />
        </Field>
        <Field label={t("form.incidentDescription")}>
          <textarea
            className={`${inputCls} h-20`}
            value={f.values.description}
            onChange={f.set("description")}
            placeholder="What happened, immediate action taken…"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? t("btn.saving") : t("btn.logIncident")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProjectModal({ open, onClose, tenantId, onDone }) {
  const { t } = useI18n();
  const f = useForm({ code: "", name: "", location: "" });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!f.values.code.trim()) errs.code = t("err.codeRequired");
    if (!f.values.name.trim()) errs.name = t("err.nameRequired");
    if (Object.keys(errs).length) return f.setErrors(errs);

    f.setBusy(true);
    try {
      await gql(
        `mutation($t:ID!,$c:String!,$n:String!,$l:String){createProject(tenant_id:$t,code:$c,name:$n,location:$l){project_id}}`,
        { t: tenantId, c: f.values.code.trim(), n: f.values.name.trim(), l: f.values.location || null }
      );
      f.setErrors({});
      onDone();
      onClose();
    } catch (err) {
      f.setErrors({ code: err.message });
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t("qa.newProject")} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={t("form.projectCode")} error={f.errors.code}>
          <input className={inputCls} value={f.values.code} onChange={f.set("code")} placeholder="PRJ-004" />
        </Field>
        <Field label={t("form.projectName")} error={f.errors.name}>
          <input className={inputCls} value={f.values.name} onChange={f.set("name")} placeholder="Riverside Bridge" />
        </Field>
        <Field label={t("form.projectLocation")}>
          <input className={inputCls} value={f.values.location} onChange={f.set("location")} placeholder="Pune" />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("btn.cancel")}
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? t("btn.saving") : t("btn.createProject")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
