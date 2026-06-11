// Quick-action modal forms: minimal fields + inline validation per the design spec.
import { useState } from "react";
import { gql } from "./api.js";
import { Modal, Field, Button, inputCls } from "./ui.jsx";

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return { values, setValues, errors, setErrors, busy, setBusy, set };
}

export function NewDPRModal({ open, onClose, tenantId, onDone }) {
  const f = useForm({ report: "" });

  async function submit(e) {
    e.preventDefault();
    if (!f.values.report.trim())
      return f.setErrors({ report: "Report notes are required." });
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
    <Modal open={open} title="New Daily Progress Report" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Progress notes" error={f.errors.report}>
          <textarea
            className={`${inputCls} h-28`}
            value={f.values.report}
            onChange={f.set("report")}
            placeholder="Work completed, blockers, manpower…"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? "Saving…" : "Submit DPR"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SafetyAuditModal({ open, onClose, tenantId, onDone }) {
  const f = useForm({ site: "", status: "COMPLETED", ppe: "90" });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!f.values.site.trim()) errs.site = "Site name is required.";
    const ppe = Number(f.values.ppe);
    if (Number.isNaN(ppe) || ppe < 0 || ppe > 100)
      errs.ppe = "PPE % must be between 0 and 100.";
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
    <Modal open={open} title="Log Safety Audit" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Site name" error={f.errors.site}>
          <input
            className={inputCls}
            value={f.values.site}
            onChange={f.set("site")}
            placeholder="Site A — Pier Casting"
          />
        </Field>
        <Field label="Checklist status">
          <select className={inputCls} value={f.values.status} onChange={f.set("status")}>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </Field>
        <Field label="PPE compliance %" error={f.errors.ppe}>
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
            Cancel
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? "Saving…" : "Log audit"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function FinanceModal({ open, onClose, tenantId, onDone }) {
  const f = useForm({ invoice: "", amount: "", due: "", period: "" });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    const amount = Number(f.values.amount);
    if (Number.isNaN(amount) || amount <= 0) errs.amount = "Enter a positive amount.";
    if (!f.values.due) errs.due = "Due date is required.";
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
    <Modal open={open} title="New Finance Record" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Invoice number">
          <input
            className={inputCls}
            value={f.values.invoice}
            onChange={f.set("invoice")}
            placeholder="INV-2026-003"
          />
        </Field>
        <Field label="Amount (₹)" error={f.errors.amount}>
          <input
            type="number"
            className={inputCls}
            value={f.values.amount}
            onChange={f.set("amount")}
          />
        </Field>
        <Field label="Due date" error={f.errors.due}>
          <input
            type="date"
            className={inputCls}
            value={f.values.due}
            onChange={f.set("due")}
          />
        </Field>
        <Field label="Filing period">
          <input
            className={inputCls}
            value={f.values.period}
            onChange={f.set("period")}
            placeholder="2026-Q2"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? "Saving…" : "Create record"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ContractModal({ open, onClose, tenantId, onDone }) {
  const f = useForm({ title: "", expiry: "" });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!f.values.title.trim()) errs.title = "Contract title is required.";
    if (!f.values.expiry) errs.expiry = "Expiry date is required.";
    if (Object.keys(errs).length) return f.setErrors(errs);

    f.setBusy(true);
    try {
      await gql(
        `mutation($t:ID!,$title:String!,$e:String!){createContract(tenant_id:$t,title:$title,expiry_date:$e){contract_id}}`,
        { t: tenantId, title: f.values.title.trim(), e: f.values.expiry }
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
    <Modal open={open} title="New Contract" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Title" error={f.errors.title}>
          <input
            className={inputCls}
            value={f.values.title}
            onChange={f.set("title")}
            placeholder="Metro Line 3 — Civil Works"
          />
        </Field>
        <Field label="Expiry date" error={f.errors.expiry}>
          <input
            type="date"
            className={inputCls}
            value={f.values.expiry}
            onChange={f.set("expiry")}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={f.busy}>
            {f.busy ? "Saving…" : "Create contract"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
