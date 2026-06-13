// Daily compliance scheduler — the cron backbone for proactive reminders.
// Pure selection helpers are separated from the DB side-effects so they can be
// unit-tested without a database. A real cron invokes runDailyJobs() once a day
// (see runScheduler.js); index.js can also run it on an interval in long-lived hosts.

// Start/end of the calendar day that is `offset` days from `now` (local time).
export function dayWindow(now, offset = 0) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Finance records whose GST filing falls due *tomorrow* and isn't filed yet.
// Pure: takes the rows + now, returns the subset — easy to test.
export function selectGstDueTomorrow(finances, now = new Date()) {
  const { start, end } = dayWindow(now, 1);
  return finances.filter((f) => {
    if (f.gst_filing_status === "FILED") return false;
    if (!f.due_date) return false;
    const due = new Date(f.due_date);
    return due >= start && due < end;
  });
}

// Human-readable reminder text for a GST-due finance record.
export function gstReminderMessage(finance) {
  const inv = finance.invoice_number || finance.finance_id;
  const amt = Number(finance.amount || 0).toLocaleString("en-IN");
  return `GST filing due tomorrow for invoice ${inv} (₹${amt}).`;
}

// Runs the daily jobs for one tenant's already-loaded finance rows.
// Idempotent: skips a reminder when a PENDING one already exists for that
// finance record + kind, so re-running the cron the same day won't duplicate.
// Returns the number of reminders created.
export async function runTenantReminders(prisma, tenant_id, finances, now = new Date()) {
  const due = selectGstDueTomorrow(finances, now);
  let created = 0;
  for (const f of due) {
    const existing = await prisma.reminder.findFirst({
      where: { tenant_id, kind: "GST_DUE", ref_id: f.finance_id, status: "PENDING" },
    });
    if (existing) continue;
    await prisma.reminder.create({
      data: {
        tenant_id,
        kind: "GST_DUE",
        message: gstReminderMessage(f),
        due_date: f.due_date,
        ref_id: f.finance_id,
      },
    });
    created++;
  }
  return created;
}

// Platform-wide daily run: scans every tenant's finances and creates reminders.
// Used by the cron entrypoint. `writeAuditLog` is injected so it can fail soft.
export async function runDailyJobs(prisma, { now = new Date(), writeAuditLog } = {}) {
  const finances = await prisma.finance.findMany();
  const byTenant = new Map();
  for (const f of finances) {
    if (!byTenant.has(f.tenant_id)) byTenant.set(f.tenant_id, []);
    byTenant.get(f.tenant_id).push(f);
  }

  let created = 0;
  for (const [tenant_id, rows] of byTenant) {
    const n = await runTenantReminders(prisma, tenant_id, rows, now);
    created += n;
    if (n > 0 && writeAuditLog) {
      await writeAuditLog({
        tenant_id,
        user_id: "system",
        action: "scheduler.gstReminders",
        metadata: { created: n },
      }).catch(() => {});
    }
  }
  return { tenants: byTenant.size, created };
}
