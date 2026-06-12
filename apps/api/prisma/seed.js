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
    // Dashboard role architecture
    ["superadmin@demo.test", "SUPER_ADMIN"],
    ["companyadmin@demo.test", "COMPANY_ADMIN"],
    ["contractor@demo.test", "CONTRACTOR"],
    ["vendor@demo.test", "VENDOR"],
  ];

  for (const [email, role] of roles) {
    await prisma.user.create({
      data: { tenant_id: tenant.tenant_id, email, password_hash, role },
    });
  }

  // Subcontractor registry (for Contractor management + dashboards).
  await prisma.contractor.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        name: "Apex Civil Works",
        trade: "Civil",
        contact_email: "ops@apexcivil.test",
        active_projects: 3,
        compliance_score: 88,
      },
      {
        tenant_id: tenant.tenant_id,
        name: "Volt Electrical Pvt Ltd",
        trade: "Electrical",
        contact_email: "pm@volt.test",
        active_projects: 1,
        compliance_score: 64,
        status: "SUSPENDED",
      },
    ],
  });

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

  // --- Geo-tagged project sites (real Indian coordinates) for the map ---
  await prisma.site.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        name: "Highway Phase II — Site A",
        latitude: 12.9716,
        longitude: 77.5946, // Bengaluru
        status: "COMPLIANT",
      },
      {
        tenant_id: tenant.tenant_id,
        name: "Skyline Residency — Tower B",
        latitude: 17.385,
        longitude: 78.4867, // Hyderabad
        status: "PENDING",
      },
      {
        tenant_id: tenant.tenant_id,
        name: "Coastal Embankment Works",
        latitude: 13.0827,
        longitude: 80.2707, // Chennai
        status: "NON_COMPLIANT",
      },
    ],
  });

  await prisma.workflowStep.create({
    data: { tenant_id: tenant.tenant_id, name: "Approve RA Bill #1" },
  });

  // A second tenant so the Super Admin platform view shows a real portfolio.
  const tenant2 = await prisma.tenant.create({
    data: {
      company_name: "BuildWell Infra Ltd",
      gst_number: "27BWELL5678K1Z3",
      rera_id: "RERA-MH-2026-014",
      subscription_plan: "ENTERPRISE",
      subscriptions: { create: { plan_type: "ENTERPRISE" } },
      users: {
        create: {
          email: "admin@buildwell.test",
          password_hash,
          role: "COMPANY_ADMIN",
        },
      },
      contracts: {
        create: [
          { title: "Metro Line 5 — Viaduct", expiry_date: new Date("2028-03-31"), status: "ACTIVE" },
          { title: "Airport Terminal Expansion", expiry_date: new Date("2027-09-30"), status: "ACTIVE" },
        ],
      },
      finances: {
        create: [
          { amount: 9500000, due_date: new Date("2026-08-15"), gst_filing_status: "FILED", tds_status: "FILED", ra_bill_status: "APPROVED" },
          { amount: 4200000, due_date: new Date("2026-07-01") },
        ],
      },
    },
  });

  // Link the external demo users to their own Contractor / Vendor record.
  const firstContractor = await prisma.contractor.findFirst({
    where: { tenant_id: tenant.tenant_id },
  });
  const firstVendor = await prisma.vendor.findFirst({
    where: { tenant_id: tenant.tenant_id },
  });
  if (firstContractor)
    await prisma.user.update({
      where: { email: "contractor@demo.test" },
      data: { linked_id: firstContractor.contractor_id },
    });
  if (firstVendor)
    await prisma.user.update({
      where: { email: "vendor@demo.test" },
      data: { linked_id: firstVendor.vendor_id },
    });

  console.log("✅ Seed complete.");
  console.log(`   Tenant 2: ${tenant2.company_name} (${tenant2.tenant_id})`);
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
