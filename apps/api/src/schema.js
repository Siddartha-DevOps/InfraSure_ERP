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
    SUPER_ADMIN
    COMPANY_ADMIN
    CONTRACTOR
    VENDOR
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
    project_id: ID
    title: String!
    contract_type: String!
    expiry_date: String!
    status: String!
    document_url: String
    version: Int!
  }

  # A project groups contracts + sites; compliance_status is a 🟢/🟡/🔴 roll-up.
  type Project {
    project_id: ID!
    tenant_id: ID!
    code: String!
    name: String!
    location: String
    contract_count: Int!
    site_count: Int!
    compliance_status: String! # COMPLIANT | PENDING | NON_COMPLIANT
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

  # A logged safety incident (injury, near-miss, property/environmental event).
  type Incident {
    incident_id: ID!
    tenant_id: ID!
    project_id: ID
    title: String!
    site_name: String
    category: String! # INJURY | NEAR_MISS | PROPERTY_DAMAGE | ENVIRONMENTAL | OTHER
    severity: String! # LOW | MEDIUM | HIGH | CRITICAL
    status: String! # OPEN | INVESTIGATING | RESOLVED | CLOSED
    description: String
    reported_by: String
    occurred_at: String!
    resolved_at: String
  }

  # An environmental clearance / statutory consent with renewal tracking.
  type Clearance {
    clearance_id: ID!
    tenant_id: ID!
    project_id: ID
    clearance_type: String! # CONSENT_TO_OPERATE | CONSENT_TO_ESTABLISH | FOREST | CRZ | ENVIRONMENTAL_CLEARANCE | OTHER
    authority: String
    reference_no: String
    issue_date: String
    expiry_date: String!
    status: String! # ACTIVE | RENEWED | EXPIRED
    renewal_status: String! # VALID | EXPIRING | EXPIRED (derived from expiry_date)
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

  # ---- Dashboard role architecture (shared widgets + platform/company views) ----

  type Contractor {
    contractor_id: ID!
    tenant_id: ID!
    name: String!
    trade: String
    contact_email: String
    active_projects: Int!
    compliance_score: Int!
    status: String!
  }

  # One point on a time-series chart (e.g. monthly compliance trend).
  type TrendPoint {
    label: String!
    value: Float!
  }

  # Composite scores powering the shared score widgets.
  type DashboardScores {
    compliance_score: Float! # 0-100, higher is better
    risk_score: Float! # 0-100, higher is worse
    project_health_score: Float! # 0-100, higher is better
    open_alerts: Int!
    expiring_contracts: Int!
    expiring_certificates: Int!
  }

  # One immutable audit-log entry (from MongoDB) for the Audit Feed widget.
  type AuditEntry {
    tenant_id: ID
    user_id: ID
    action: String!
    timestamp: String!
    metadata: String
  }

  # Platform-wide rollup for the Super Admin dashboard (cross-tenant).
  type PlatformStats {
    total_tenants: Int!
    total_users: Int!
    total_contracts: Int!
    active_subscriptions: Int!
    mrr_inr: Int!
    avg_compliance: Float!
    open_disputes: Int!
  }

  # Per-tenant summary row for the Super Admin tenant table.
  type TenantSummary {
    tenant_id: ID!
    company_name: String!
    subscription_plan: String!
    user_count: Int!
    contract_count: Int!
    compliance_score: Float!
    status: String!
  }

  # Geo-tagged project site for the compliance map.
  type Site {
    site_id: ID!
    tenant_id: ID!
    name: String!
    latitude: Float!
    longitude: Float!
    status: String!
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

  # A system-generated compliance reminder (created by the daily scheduler).
  type Reminder {
    reminder_id: ID!
    tenant_id: ID!
    kind: String!
    message: String!
    due_date: String
    ref_id: ID
    status: String!
    created_at: String!
  }

  # Aggregated audit document-retrieval timing (how fast packs/docs are produced).
  type RetrievalMetrics {
    count: Int!
    avg_seconds: Float!
    p95_seconds: Float!
    fastest_seconds: Float!
    last_retrieved: String
  }

  # A point-in-time audit-readiness snapshot for the historical trend chart.
  type ReadinessSnapshot {
    snapshot_id: ID!
    tenant_id: ID!
    score: Float!
    documents_verified: Int!
    documents_total: Int!
    pending_approvals: Int!
    open_disputes: Int!
    vendor_compliance_rate: Float!
    captured_at: String!
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
    getProjects(tenant_id: ID!): [Project!]!
    # Contracts expiring within the given window (default 30 days) — expiry alerts.
    getExpiringContracts(tenant_id: ID!, withinDays: Int = 30): [Contract!]!
    getFinanceRecords(tenant_id: ID!): [Finance!]!
    getSafetyAudits(tenant_id: ID!): [Safety!]!
    getIncidents(tenant_id: ID!): [Incident!]!
    getClearances(tenant_id: ID!): [Clearance!]!
    # Clearances expiring within the given window (default 30 days) — renewal alerts.
    getExpiringClearances(tenant_id: ID!, withinDays: Int = 30): [Clearance!]!
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
    # Historical audit-readiness snapshots (oldest→newest) for the trend chart.
    getAuditReadinessTrend(tenant_id: ID!, limit: Int = 12): [ReadinessSnapshot!]!
    # Avg/p95 document-retrieval timing over the window (audit retrieval KPI).
    getRetrievalMetrics(tenant_id: ID!, withinDays: Int = 30): RetrievalMetrics!
    # Pending scheduler-generated reminders (e.g. GST due tomorrow), soonest first.
    getReminders(tenant_id: ID!): [Reminder!]!

    # --- Phase 4 ---
    getAIInsights(tenant_id: ID!): AIInsights!
    getIntegrationStatus(tenant_id: ID!): [IntegrationStatus!]!

    # --- Dashboards ---
    getDPRs(tenant_id: ID!): [Dpr!]!
    getWorkflowSteps(tenant_id: ID!): [WorkflowStep!]!
    getSites(tenant_id: ID!): [Site!]!

    # --- Dashboard role architecture ---
    getDashboardSummary(tenant_id: ID!): DashboardScores!
    # 6-month compliance trend (filing rate per month) for the Reports module.
    getComplianceTrend(tenant_id: ID!): [TrendPoint!]!
    getContractors(tenant_id: ID!): [Contractor!]!
    # External-role self views (CONTRACTOR / VENDOR see only their own record)
    getMyContractorProfile(tenant_id: ID!): Contractor
    getMyVendorProfile(tenant_id: ID!): Vendor
    getAuditFeed(tenant_id: ID!, limit: Int = 15): [AuditEntry!]!

    # Platform-wide (SUPER_ADMIN only; cross-tenant)
    getPlatformStats: PlatformStats!
    getTenants: [TenantSummary!]!
    getPlatformAuditFeed(limit: Int = 20): [AuditEntry!]!
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

    # --- Projects ---
    createProject(tenant_id: ID!, code: String!, name: String!, location: String): Project!

    # --- Contracts ---
    createContract(
      tenant_id: ID!
      title: String!
      expiry_date: String!
      contract_type: String
      project_id: ID
    ): Contract!
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
    logIncident(
      tenant_id: ID!
      title: String!
      category: String
      severity: String
      site_name: String
      description: String
      reported_by: String
      project_id: ID
    ): Incident!
    updateIncidentStatus(tenant_id: ID!, incident_id: ID!, status: String!): Incident!
    createClearance(
      tenant_id: ID!
      clearance_type: String!
      expiry_date: String!
      authority: String
      reference_no: String
      issue_date: String
      project_id: ID
    ): Clearance!
    # Renew a clearance: extends expiry to new_expiry_date and marks it RENEWED.
    renewClearance(tenant_id: ID!, clearance_id: ID!, new_expiry_date: String!): Clearance!

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
    # Capture the current audit-readiness as a snapshot (idempotent per day).
    # A daily scheduler calls this; can also be triggered manually.
    captureAuditReadinessSnapshot(tenant_id: ID!): ReadinessSnapshot!
    # Record one document-retrieval timing (e.g. Compliance Pack produced in N ms).
    recordRetrieval(tenant_id: ID!, kind: String!, duration_ms: Int!, label: String): RetrievalMetrics!
    # Run the daily reminder scan for this tenant on demand (returns count created).
    # The same logic runs automatically via the cron scheduler.
    runDailyReminders(tenant_id: ID!): Int!
    # Dismiss a reminder once actioned.
    dismissReminder(tenant_id: ID!, reminder_id: ID!): Reminder!

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

    # --- Contractors ---
    createContractor(
      tenant_id: ID!
      name: String!
      trade: String
      contact_email: String
    ): Contractor!
    updateContractorStatus(tenant_id: ID!, contractor_id: ID!, status: String!): Contractor!

    # --- Sites (geo map) ---
    createSite(
      tenant_id: ID!
      name: String!
      latitude: Float!
      longitude: Float!
      status: String
    ): Site!
    updateSiteStatus(tenant_id: ID!, site_id: ID!, status: String!): Site!

    # --- Phase 4: External integrations ---
    syncTallyLedger(tenant_id: ID!): IntegrationResult!
    fileGSTReturn(tenant_id: ID!, finance_id: ID!): IntegrationResult!
    syncReraUpdates(tenant_id: ID!): IntegrationResult!
    requestAadhaarESign(tenant_id: ID!, contract_id: ID!): IntegrationResult!
    importBimModel(tenant_id: ID!, url: String): IntegrationResult!
  }
`;
