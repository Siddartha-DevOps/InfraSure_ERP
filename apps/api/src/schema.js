// GraphQL SDL for InfraSure ERP (Phase 1).
// Core + compliance domain types follow the product-owner schema design,
// extended with auth (signup/login) needed to issue tenant_id + role JWTs.

export const typeDefs = /* GraphQL */ `
  enum Role {
    ENGINEER
    ACCOUNTANT
    COMPLIANCE_OFFICER
    PROJECT_MANAGER
    ADMIN
  }

  type Tenant {
    tenant_id: ID!
    company_name: String!
    gst_number: String
    rera_id: String
    subscription_plan: String
  }

  type User {
    user_id: ID!
    tenant_id: ID!
    email: String!
    role: Role!
    status: String!
  }

  type AuthPayload {
    token: String!
    user: User!
    tenant: Tenant!
  }

  type Contract {
    contract_id: ID!
    tenant_id: ID!
    title: String!
    expiry_date: String!
    status: String!
    document_url: String
    version: Int!
  }

  type Finance {
    finance_id: ID!
    tenant_id: ID!
    gst_filing_status: String!
    tds_status: String!
    ra_bill_status: String!
    amount: Float!
    due_date: String!
  }

  type Safety {
    safety_id: ID!
    tenant_id: ID!
    audit_date: String!
    checklist_status: String!
    incident_report_url: String
  }

  type Dpr {
    dpr_id: ID!
    tenant_id: ID!
    report_data: String!
    created_at: String!
  }

  type EnvironmentalReport {
    report_id: ID!
    tenant_id: ID!
    report_data: String!
    created_at: String!
  }

  type WorkflowStep {
    step_id: ID!
    tenant_id: ID!
    name: String!
    status: String!
  }

  type Query {
    me: User
    getTenant(tenant_id: ID!): Tenant
    getUsers(tenant_id: ID!): [User!]!
    getContracts(tenant_id: ID!): [Contract!]!
    getFinanceRecords(tenant_id: ID!): [Finance!]!
    getSafetyAudits(tenant_id: ID!): [Safety!]!
  }

  type Mutation {
    # --- Auth (public) ---
    signupTenant(
      company_name: String!
      gst_number: String
      rera_id: String
      admin_email: String!
      admin_password: String!
    ): AuthPayload!
    login(email: String!, password: String!): AuthPayload!

    # --- Contracts ---
    createContract(tenant_id: ID!, title: String!, expiry_date: String!): Contract!
    updateContractStatus(tenant_id: ID!, contract_id: ID!, status: String!): Contract!

    # --- Finance ---
    fileGST(tenant_id: ID!, finance_id: ID!): Finance!
    approveRABill(tenant_id: ID!, finance_id: ID!): Finance!

    # --- Safety / field ---
    logSafetyAudit(tenant_id: ID!, checklist_status: String!): Safety!
    createDPR(tenant_id: ID!, report_data: String!): Dpr!

    # --- Compliance / environment ---
    logEnvironmentalReport(tenant_id: ID!, report_data: String!): EnvironmentalReport!

    # --- Project management ---
    approveWorkflowStep(tenant_id: ID!, step_id: ID!): WorkflowStep!
    assignUserRole(tenant_id: ID!, user_id: ID!, role: Role!): User!
  }
`;
