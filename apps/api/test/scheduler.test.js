// Tests for the daily compliance scheduler — GST-due-tomorrow selection,
// reminder messaging, and idempotent reminder creation.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayWindow,
  selectGstDueTomorrow,
  gstReminderMessage,
  runTenantReminders,
} from "../src/scheduler.js";

// Fixed reference: 2026-06-13 10:00 local → "tomorrow" is 2026-06-14.
const NOW = new Date("2026-06-13T10:00:00");
const at = (d) => new Date(`${d}T00:00:00`);

test("dayWindow(now, 1) spans exactly the next calendar day", () => {
  const { start, end } = dayWindow(NOW, 1);
  assert.equal(start.getDate(), 14);
  assert.equal(end.getDate(), 15);
  assert.equal(end - start, 24 * 60 * 60 * 1000);
});

test("selectGstDueTomorrow picks only pending GST filings due tomorrow", () => {
  const finances = [
    { finance_id: "a", gst_filing_status: "PENDING", due_date: at("2026-06-14") }, // due tomorrow ✓
    { finance_id: "b", gst_filing_status: "FILED", due_date: at("2026-06-14") }, // already filed ✗
    { finance_id: "c", gst_filing_status: "PENDING", due_date: at("2026-06-15") }, // day after ✗
    { finance_id: "d", gst_filing_status: "PENDING", due_date: at("2026-06-13") }, // today ✗
    { finance_id: "e", gst_filing_status: "PENDING", due_date: null }, // no date ✗
  ];
  const due = selectGstDueTomorrow(finances, NOW);
  assert.deepEqual(due.map((f) => f.finance_id), ["a"]);
});

test("selectGstDueTomorrow matches a late-evening due timestamp", () => {
  const finances = [
    { finance_id: "x", gst_filing_status: "PENDING", due_date: new Date("2026-06-14T23:30:00") },
  ];
  assert.equal(selectGstDueTomorrow(finances, NOW).length, 1);
});

test("gstReminderMessage includes invoice and amount", () => {
  const msg = gstReminderMessage({ invoice_number: "INV-9", amount: 125000 });
  assert.match(msg, /INV-9/);
  assert.match(msg, /1,25,000/); // en-IN grouping
});

test("runTenantReminders creates one reminder and is idempotent", async () => {
  const store = [];
  const prisma = {
    reminder: {
      findFirst: async ({ where }) =>
        store.find(
          (r) => r.ref_id === where.ref_id && r.kind === where.kind && r.status === where.status
        ) || null,
      create: async ({ data }) => {
        const row = { reminder_id: `r${store.length}`, status: "PENDING", ...data };
        store.push(row);
        return row;
      },
    },
  };
  const finances = [
    { finance_id: "a", gst_filing_status: "PENDING", due_date: at("2026-06-14"), invoice_number: "INV-1", amount: 1000 },
  ];

  const first = await runTenantReminders(prisma, "t1", finances, NOW);
  assert.equal(first, 1);
  assert.equal(store.length, 1);

  // Re-running the same day must not duplicate.
  const second = await runTenantReminders(prisma, "t1", finances, NOW);
  assert.equal(second, 0);
  assert.equal(store.length, 1);
});
