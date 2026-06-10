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

  await prisma.finance.create({
    data: {
      tenant_id: tenant.tenant_id,
      amount: 1500000,
      due_date: new Date("2026-07-20"),
    },
  });

  await prisma.safety.create({
    data: { tenant_id: tenant.tenant_id, checklist_status: "PENDING" },
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
