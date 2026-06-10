// Seeds one demo tenant with a user per role plus sample compliance records.
import "dotenv/config";
import prisma from "@infrasure/db";
import bcrypt from "bcryptjs";

const PASSWORD = "Passw0rd!";

async function main() {
  const password_hash = await bcrypt.hash(PASSWORD, 10);

  const tenant = await prisma.tenant.create({
    data: {
      company_name: "Demo Constructions Pvt Ltd",
      gst_number: "29ABCDE1234F1Z5",
      rera_id: "RERA-KA-2026-001",
      subscription_plan: "PRO",
      subscriptions: { create: { plan_type: "PRO" } },
    },
  });

  const roles = [
    ["admin@demo.test", "ADMIN"],
    ["engineer@demo.test", "ENGINEER"],
    ["accountant@demo.test", "ACCOUNTANT"],
    ["officer@demo.test", "COMPLIANCE_OFFICER"],
    ["pm@demo.test", "PROJECT_MANAGER"],
  ];

  for (const [email, role] of roles) {
    await prisma.user.create({
      data: { tenant_id: tenant.tenant_id, email, password_hash, role },
    });
  }

  await prisma.contract.create({
    data: {
      tenant_id: tenant.tenant_id,
      title: "Highway Phase II — Main Works Contract",
      expiry_date: new Date("2027-03-31"),
      status: "ACTIVE",
    },
  });

  // --- Financial Compliance (mix of filed/pending + an overdue unpaid bill) ---
  await prisma.finance.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        invoice_number: "INV-2026-001",
        filing_period: "2026-Q1",
        amount: 1500000,
        due_date: new Date("2026-07-20"),
        gst_filing_status: "FILED",
        tds_status: "FILED",
        ra_bill_status: "APPROVED",
        paid_date: new Date("2026-06-01"),
      },
      {
        tenant_id: tenant.tenant_id,
        invoice_number: "INV-2026-002",
        filing_period: "2026-Q1",
        amount: 820000,
        due_date: new Date("2026-05-31"), // past due, unpaid → overdue KPI
        gst_filing_status: "PENDING",
        tds_status: "PENDING",
        ra_bill_status: "PENDING",
      },
    ],
  });

  // --- Safety & Environment ---
  await prisma.safety.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        site_name: "Site A — Pier Casting",
        checklist_status: "COMPLETED",
        ppe_compliance: 92,
      },
      {
        tenant_id: tenant.tenant_id,
        site_name: "Site B — Embankment",
        checklist_status: "PENDING",
        ppe_compliance: 70,
      },
    ],
  });

  await prisma.environmentalLog.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        log_type: "POLLUTION",
        reading: 78,
        unit: "AQI",
        notes: "Dust suppression active",
      },
      {
        tenant_id: tenant.tenant_id,
        log_type: "WASTE",
        reading: 3.2,
        unit: "tonnes",
        notes: "Construction debris hauled to approved site",
      },
    ],
  });

  // --- Labour & RERA ---
  await prisma.labourFiling.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        filing_type: "PF",
        period: "2026-05",
        worker_count: 120,
        amount: 360000,
        status: "FILED",
        filed_date: new Date("2026-06-05"),
      },
      {
        tenant_id: tenant.tenant_id,
        filing_type: "ESI",
        period: "2026-05",
        worker_count: 120,
        amount: 90000,
        status: "PENDING",
      },
    ],
  });

  await prisma.reraFiling.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        project_name: "Skyline Residency Tower A",
        filing_type: "QUARTERLY_UPDATE",
        status: "FILED",
        due_date: new Date("2026-06-30"),
        filed_date: new Date("2026-06-08"),
      },
      {
        tenant_id: tenant.tenant_id,
        project_name: "Skyline Residency Tower B",
        filing_type: "QUARTERLY_UPDATE",
        status: "PENDING",
        due_date: new Date("2026-07-31"),
      },
    ],
  });

  // --- Vendors (one with a soon-to-expire certification) ---
  const soon = new Date();
  soon.setDate(soon.getDate() + 20);
  await prisma.vendor.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        name: "Apex Scaffolding Co.",
        gst_number: "29APEXS1234G1Z2",
        certification_name: "ISO 45001 Safety",
        certification_expiry: soon, // within 30 days → expiring-cert alert
        status: "ACTIVE",
      },
      {
        tenant_id: tenant.tenant_id,
        name: "Ready-Mix Concrete Ltd",
        gst_number: "29RMCON5678H1Z9",
        certification_name: "BIS Concrete Grade",
        certification_expiry: new Date("2027-01-31"),
        status: "ACTIVE",
      },
    ],
  });

  // --- Disputes ---
  await prisma.dispute.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        title: "Delay penalty claim — Highway Phase II",
        dispute_type: "CONTRACT",
        counterparty: "State Highways Authority",
        amount: 2500000,
        status: "IN_ARBITRATION",
        escalation_level: 1,
      },
      {
        tenant_id: tenant.tenant_id,
        title: "Subcontractor payment dispute",
        dispute_type: "PAYMENT",
        counterparty: "Apex Scaffolding Co.",
        amount: 450000,
        status: "OPEN",
      },
    ],
  });

  await prisma.workflowStep.create({
    data: { tenant_id: tenant.tenant_id, name: "Approve RA Bill #1" },
  });

  console.log("✅ Seed complete.");
  console.log(`   Tenant: ${tenant.company_name} (${tenant.tenant_id})`);
  console.log(`   Login with any of these / password "${PASSWORD}":`);
  roles.forEach(([email, role]) => console.log(`     - ${email}  [${role}]`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
