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
    invoice_number: String
    filing_period: String
    gst_filing_status: String!
    tds_status: String!
    ra_bill_status: String!
    amount: Float!
    due_date: String!
    paid_date: String
  }

  type Safety {
    safety_id: ID!
    tenant_id: ID!
    site_name: String
    audit_date: String!
    checklist_status: String!
    ppe_compliance: Int!
    incident_report_url: String
  }

  type EnvironmentalLog {
    env_log_id: ID!
    tenant_id: ID!
    log_type: String!
    reading: Float!
    unit: String!
    notes: String
    recorded_at: String!
  }

  type LabourFiling {
    labour_id: ID!
    tenant_id: ID!
    filing_type: String!
    period: String!
    worker_count: Int!
    amount: Float!
    status: String!
    filed_date: String
  }

  type ReraFiling {
    filing_id: ID!
    tenant_id: ID!
    project_name: String!
    filing_type: String!
    status: String!
    due_date: String!
    filed_date: String
  }

  type Vendor {
    vendor_id: ID!
    tenant_id: ID!
    name: String!
    gst_number: String
    certification_name: String
    certification_expiry: String
    status: String!
  }

  type Dispute {
    dispute_id: ID!
    tenant_id: ID!
    title: String!
    dispute_type: String!
    counterparty: String
    amount: Float!
    status: String!
    escalation_level: Int!
    opened_at: String!
    resolved_at: String
  }

  type Subscription {
    subscription_id: ID!
    tenant_id: ID!
    plan_type: String!
    billing_cycle: String!
    status: String!
    current_period_end: String
  }

  type BillingTier {
    code: String!
    name: String!
    price_inr: Int!
    features: [String!]!
  }

  type CheckoutSession {
    session_id: String!
    url: String!
    plan_type: String!
    driver: String!
  }

  # --- Phase 4: AI engine ---
  type AIAnomaly {
    finance_id: ID
    type: String!
    severity: String!
    detail: String!
  }

  type AIInsights {
    available: Boolean!
    predictive_score: Float
    risk_level: String!
    weak_factors: [String!]!
    anomalies: [AIAnomaly!]!
  }

  # --- Phase 4: External integrations ---
  type IntegrationStatus {
    integration: String!
    configured: Boolean!
    driver: String!
  }

  type IntegrationResult {
    integration: String!
    status: String!
    driver: String!
    reference: String!
    detail: String!
  }

  # Phase 3 audit-readiness rollup.
  type AuditReadiness {
    documents_verified: Int!
    documents_total: Int!
    pending_approvals: Int!
    open_disputes: Int!
    vendor_compliance_rate: Float!
    audit_readiness_score: Float!
  }

  # Computed compliance KPIs for the Phase 2 dashboard.
  type ComplianceKPIs {
    gst_filing_compliance: Float!
    tds_filing_compliance: Float!
    ra_bill_approval_rate: Float!
    safety_audit_completion: Float!
    avg_ppe_compliance: Float!
    pf_esi_filing_rate: Float!
    rera_filing_rate: Float!
    overdue_payments: Int!
    audit_readiness_score: Float!
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
    # Contracts expiring within the given window (default 30 days) — expiry alerts.
    getExpiringContracts(tenant_id: ID!, withinDays: Int = 30): [Contract!]!
    getFinanceRecords(tenant_id: ID!): [Finance!]!
    getSafetyAudits(tenant_id: ID!): [Safety!]!
    getEnvironmentalLogs(tenant_id: ID!): [EnvironmentalLog!]!
    getLabourFilings(tenant_id: ID!): [LabourFiling!]!
    getReraFilings(tenant_id: ID!): [ReraFiling!]!
    # Aggregated compliance KPIs across all Phase 2 modules.
    getComplianceKPIs(tenant_id: ID!): ComplianceKPIs!

    # --- Phase 3 ---
    getVendors(tenant_id: ID!): [Vendor!]!
    getExpiringCertifications(tenant_id: ID!, withinDays: Int = 30): [Vendor!]!
    getDisputes(tenant_id: ID!): [Dispute!]!
    getSubscription(tenant_id: ID!): Subscription
    getBillingTiers: [BillingTier!]!
    getAuditReadiness(tenant_id: ID!): AuditReadiness!

    # --- Phase 4 ---
    getAIInsights(tenant_id: ID!): AIInsights!
    getIntegrationStatus(tenant_id: ID!): [IntegrationStatus!]!
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
    createFinanceRecord(
      tenant_id: ID!
      amount: Float!
      due_date: String!
      invoice_number: String
      filing_period: String
    ): Finance!
    fileGST(tenant_id: ID!, finance_id: ID!): Finance!
    fileTDS(tenant_id: ID!, finance_id: ID!): Finance!
    approveRABill(tenant_id: ID!, finance_id: ID!): Finance!
    recordPayment(tenant_id: ID!, finance_id: ID!): Finance!

    # --- Safety / field ---
    logSafetyAudit(
      tenant_id: ID!
      checklist_status: String!
      site_name: String
      ppe_compliance: Int
    ): Safety!
    createDPR(tenant_id: ID!, report_data: String!): Dpr!

    # --- Compliance / environment ---
    logEnvironmentalReport(tenant_id: ID!, report_data: String!): EnvironmentalReport!
    logEnvironmentalLog(
      tenant_id: ID!
      log_type: String!
      reading: Float!
      unit: String
      notes: String
    ): EnvironmentalLog!

    # --- Labour & RERA ---
    createLabourFiling(
      tenant_id: ID!
      filing_type: String!
      period: String!
      worker_count: Int
      amount: Float
    ): LabourFiling!
    updateLabourFilingStatus(tenant_id: ID!, labour_id: ID!, status: String!): LabourFiling!
    createReraFiling(
      tenant_id: ID!
      project_name: String!
      due_date: String!
      filing_type: String
    ): ReraFiling!
    updateReraFilingStatus(tenant_id: ID!, filing_id: ID!, status: String!): ReraFiling!

    # --- Project management ---
    approveWorkflowStep(tenant_id: ID!, step_id: ID!): WorkflowStep!
    assignUserRole(tenant_id: ID!, user_id: ID!, role: Role!): User!

    # --- Phase 3: Vendors ---
    createVendor(
      tenant_id: ID!
      name: String!
      gst_number: String
      certification_name: String
      certification_expiry: String
    ): Vendor!
    updateVendorStatus(tenant_id: ID!, vendor_id: ID!, status: String!): Vendor!

    # --- Phase 3: Disputes ---
    createDispute(
      tenant_id: ID!
      title: String!
      dispute_type: String
      counterparty: String
      amount: Float
    ): Dispute!
    updateDisputeStatus(tenant_id: ID!, dispute_id: ID!, status: String!): Dispute!
    escalateDispute(tenant_id: ID!, dispute_id: ID!): Dispute!

    # --- Phase 3: Billing ---
    changeSubscriptionPlan(tenant_id: ID!, plan_type: String!): Subscription!
    createBillingCheckout(tenant_id: ID!, plan_type: String!): CheckoutSession!

    # --- Phase 4: External integrations ---
    syncTallyLedger(tenant_id: ID!): IntegrationResult!
    fileGSTReturn(tenant_id: ID!, finance_id: ID!): IntegrationResult!
    syncReraUpdates(tenant_id: ID!): IntegrationResult!
    requestAadhaarESign(tenant_id: ID!, contract_id: ID!): IntegrationResult!
    importBimModel(tenant_id: ID!, url: String): IntegrationResult!
  }
`;
