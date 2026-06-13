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

  // Projects (group contracts + sites for the compliance roll-up).
  const projHighway = await prisma.project.create({
    data: { tenant_id: tenant.tenant_id, code: "PRJ-001", name: "Highway Phase II", location: "Bengaluru" },
  });
  const projSkyline = await prisma.project.create({
    data: { tenant_id: tenant.tenant_id, code: "PRJ-002", name: "Skyline Residency", location: "Hyderabad" },
  });
  const projCoastal = await prisma.project.create({
    data: { tenant_id: tenant.tenant_id, code: "PRJ-003", name: "Coastal Embankment", location: "Chennai" },
  });

  await prisma.contract.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        project_id: projHighway.project_id,
        title: "Highway Phase II — Main Works Contract",
        contract_type: "WORK_ORDER",
        expiry_date: new Date("2027-03-31"),
        status: "ACTIVE",
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projSkyline.project_id,
        title: "Skyline — Builder's All-Risk Insurance",
        contract_type: "INSURANCE",
        expiry_date: new Date("2026-07-10"), // expiring soon → PENDING
        status: "ACTIVE",
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projCoastal.project_id,
        title: "Coastal Embankment — Master Agreement",
        contract_type: "AGREEMENT",
        expiry_date: new Date("2026-05-31"), // expired → NON_COMPLIANT
        status: "ACTIVE",
      },
    ],
  });

  // --- Financial Compliance (mix of filed/pending + an overdue unpaid bill) ---
  // Tomorrow (00:00) so the GST-due-tomorrow scheduler has a live target.
  const dueTomorrow = new Date();
  dueTomorrow.setHours(0, 0, 0, 0);
  dueTomorrow.setDate(dueTomorrow.getDate() + 1);

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
      {
        tenant_id: tenant.tenant_id,
        invoice_number: "INV-2026-003",
        filing_period: "2026-Q2",
        amount: 640000,
        due_date: dueTomorrow, // GST due tomorrow → scheduler reminder target
        gst_filing_status: "PENDING",
        tds_status: "PENDING",
        ra_bill_status: "PENDING",
      },
    ],
  });

  // A pre-generated reminder (the daily scheduler creates these in production).
  await prisma.reminder.create({
    data: {
      tenant_id: tenant.tenant_id,
      kind: "GST_DUE",
      message: "GST filing due tomorrow for invoice INV-2026-003 (₹6,40,000).",
      due_date: dueTomorrow,
      ref_id: "INV-2026-003",
    },
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

  // --- Safety incidents (first-class incident log) ---
  await prisma.incident.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        project_id: projHighway.project_id,
        title: "Worker slip near pier formwork",
        site_name: "Site A — Pier Casting",
        category: "INJURY",
        severity: "MEDIUM",
        status: "INVESTIGATING",
        description: "Minor ankle injury; first aid administered. Wet surface flagged.",
        reported_by: "Site Engineer",
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projCoastal.project_id,
        title: "Crane load swing near-miss",
        site_name: "Site B — Embankment",
        category: "NEAR_MISS",
        severity: "HIGH",
        status: "OPEN",
        description: "Load swung close to crew during high wind. No injuries.",
        reported_by: "Safety Officer",
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projSkyline.project_id,
        title: "Diesel spill at generator bay",
        site_name: "Tower A — Basement",
        category: "ENVIRONMENTAL",
        severity: "LOW",
        status: "RESOLVED",
        description: "~5L spill contained with spill kit; area cleaned.",
        reported_by: "Site Supervisor",
        resolved_at: new Date("2026-05-20"),
      },
    ],
  });

  // --- Environmental clearances (renewal tracking) ---
  await prisma.clearance.createMany({
    data: [
      {
        tenant_id: tenant.tenant_id,
        project_id: projHighway.project_id,
        clearance_type: "ENVIRONMENTAL_CLEARANCE",
        authority: "MoEFCC",
        reference_no: "EC/2024/HW-2117",
        issue_date: new Date("2024-04-01"),
        expiry_date: new Date("2027-03-31"), // valid
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projSkyline.project_id,
        clearance_type: "CONSENT_TO_OPERATE",
        authority: "State PCB",
        reference_no: "CTO/2025/SKY-883",
        issue_date: new Date("2025-07-01"),
        expiry_date: new Date("2026-06-25"), // expiring soon
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projCoastal.project_id,
        clearance_type: "CRZ",
        authority: "Coastal Zone Authority",
        reference_no: "CRZ/2023/CST-440",
        issue_date: new Date("2023-01-15"),
        expiry_date: new Date("2026-05-31"), // expired
        status: "EXPIRED",
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
        project_id: projHighway.project_id,
        name: "Highway Phase II — Site A",
        latitude: 12.9716,
        longitude: 77.5946, // Bengaluru
        status: "COMPLIANT",
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projSkyline.project_id,
        name: "Skyline Residency — Tower B",
        latitude: 17.385,
        longitude: 78.4867, // Hyderabad
        status: "PENDING",
      },
      {
        tenant_id: tenant.tenant_id,
        project_id: projCoastal.project_id,
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

  // --- Audit-readiness history (monthly snapshots powering the trend chart) ---
  // In production a daily scheduler appends these via captureAuditReadinessSnapshot.
  const monthsAgo = (n) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    d.setHours(9, 0, 0, 0);
    return d;
  };
  await prisma.readinessSnapshot.createMany({
    data: [62.4, 65.1, 68.9, 71.2, 74.8, 78.3].map((score, i) => ({
      tenant_id: tenant.tenant_id,
      score,
      documents_verified: 2 + i,
      documents_total: 8,
      pending_approvals: 6 - i,
      open_disputes: i < 3 ? 2 : 1,
      vendor_compliance_rate: 80 + i * 2,
      captured_at: monthsAgo(5 - i),
    })),
  });

  // --- Document-retrieval timings (audit retrieval KPI) ---
  await prisma.retrievalEvent.createMany({
    data: [
      { tenant_id: tenant.tenant_id, kind: "PACK", label: "Compliance Pack", duration_ms: 420 },
      { tenant_id: tenant.tenant_id, kind: "EXPORT", label: "contracts.csv", duration_ms: 180 },
      { tenant_id: tenant.tenant_id, kind: "PACK", label: "Compliance Pack", duration_ms: 510 },
      { tenant_id: tenant.tenant_id, kind: "EXPORT", label: "finance.csv", duration_ms: 240 },
      { tenant_id: tenant.tenant_id, kind: "DOCUMENT", label: "Contract PDF", duration_ms: 1320 },
    ],
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
