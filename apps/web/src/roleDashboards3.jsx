// Phase 3 external-role dashboards: Contractor, Vendor.
// Scoped self-views — each sees only their own linked record + relevant project data.
import { Card, Kpi, StatusPill } from "./ui.jsx";
import {
  ScoreGauge,
  DataTable,
  NotificationsCenter,
  MiniCalendar,
  EmptyState,
  KpiSkeleton,
  LoadingSkeleton,
  Section,
} from "./widgets.jsx";
import { ProjectMap } from "./ProjectMap.jsx";
import { useI18n } from "./i18n.jsx";

const day = (iso) => (iso || "").slice(0, 10);
const daysUntil = (iso) =>
  iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : Infinity;

// ---------------- Contractor ----------------
export function ContractorHome({ data, loading, errors = {}, onRetry, alerts, calendar }) {
  const { t } = useI18n();
  const me = data.myContractor;

  return (
    <>
      <Card title={t("ct.profile")} wide>
        <Section
          loading={loading}
          error={errors.myContractor}
          empty={!me && <EmptyState icon="🤝" title={t("ext.noProfile")} />}
          onRetry={onRetry}
          skeleton={<KpiSkeleton count={3} />}
        >
          {me && (
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <ScoreGauge label={t("score.compliance")} value={me.compliance_score} />
              <div className="grid grid-cols-2 gap-3 flex-1">
                <div className="bg-surface rounded-lg p-4">
                  <p className="text-xs text-neutral">{me.name}</p>
                  <p className="text-sm font-semibold text-gray-800">{me.trade || "—"}</p>
                  <div className="mt-1"><StatusPill value={me.status} /></div>
                </div>
                <Kpi label={t("ct.activeProjects")} value={me.active_projects} suffix="" />
                <Kpi label={t("kpi.dprsFiled")} value={(data.dprs || []).length} suffix="" />
                <Kpi label={t("kpi.safetyDone")}
                  value={(() => {
                    const s = data.safety || [];
                    const done = s.filter((x) => x.checklist_status === "COMPLETED").length;
                    return s.length ? Math.round((done / s.length) * 100) : 100;
                  })()} />
              </div>
            </div>
          )}
        </Section>
      </Card>

      <Card title={t("notif.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <NotificationsCenter alerts={alerts} />
        </Section>
      </Card>

      {!loading && !errors.sites && <ProjectMap sites={data.sites} />}

      <Card title={t("calendar.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <MiniCalendar events={calendar} />
        </Section>
      </Card>

      <Card title={t("ct.myDprs")} wide>
        <Section loading={loading} error={errors.dprs} onRetry={onRetry} skeleton={<LoadingSkeleton rows={4} />}>
          <DataTable
            rows={data.dprs || []}
            columns={[
              { key: "date", header: t("th.date"), value: (r) => day(r.created_at) },
              { key: "report", header: t("th.report"), value: (r) => r.report_data,
                render: (r) => (
                  <span className="text-gray-700">
                    {r.report_data.length > 120 ? `${r.report_data.slice(0, 120)}…` : r.report_data}
                  </span>
                ) },
            ]}
            empty={<EmptyState icon="📝" title={t("empty.noDprs")} />}
          />
        </Section>
      </Card>

      <Card title={t("ct.safety")} wide>
        <Section loading={loading} error={errors.safety} onRetry={onRetry} skeleton={<LoadingSkeleton rows={3} />}>
          <DataTable
            rows={data.safety || []}
            columns={[
              { key: "site", header: t("th.site"), value: (r) => r.site_name || "—" },
              { key: "date", header: t("th.date"), value: (r) => day(r.audit_date) },
              { key: "status", header: t("th.status"), value: (r) => r.checklist_status,
                render: (r) => <StatusPill value={r.checklist_status} /> },
              { key: "ppe", header: t("th.ppe"), value: (r) => `${r.ppe_compliance}%` },
            ]}
            empty={<EmptyState icon="🦺" title="No safety audits yet." />}
          />
        </Section>
      </Card>
    </>
  );
}

// ---------------- Vendor ----------------
export function VendorHome({ data, loading, errors = {}, onRetry, calendar }) {
  const { t } = useI18n();
  const me = data.myVendor;
  const certDays = me?.certification_expiry ? daysUntil(me.certification_expiry) : null;
  const certState =
    certDays === null ? null : certDays < 0 ? "expired" : certDays <= 30 ? "expiring" : "ok";

  return (
    <>
      <Card title={t("vn.profile")} wide>
        <Section
          loading={loading}
          error={errors.myVendor}
          empty={!me && <EmptyState icon="🏭" title={t("ext.noProfile")} />}
          onRetry={onRetry}
          skeleton={<KpiSkeleton count={3} />}
        >
          {me && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-surface rounded-lg p-4 col-span-2">
                <p className="text-xs text-neutral">{me.name}</p>
                <p className="text-sm text-gray-700">{t("vn.gst")}: {me.gst_number || "—"}</p>
                <div className="mt-1"><StatusPill value={me.status} /></div>
              </div>
              <div className="bg-surface rounded-lg p-4">
                <p className="text-xs text-neutral">{t("vn.certification")}</p>
                <p className="text-sm font-semibold text-gray-800">{me.certification_name || "—"}</p>
              </div>
              <Kpi
                label={t("vn.daysLeft")}
                value={certDays === null ? "—" : certDays}
                suffix=""
                invert
              />
            </div>
          )}
        </Section>
      </Card>

      <Card title={t("vn.certExpiry")}>
        <Section loading={loading} error={errors.myVendor} onRetry={onRetry}>
          {!me?.certification_expiry ? (
            <EmptyState icon="📜" title={t("empty.noCerts")} />
          ) : (
            <div
              className={`rounded-lg p-4 ${
                certState === "ok"
                  ? "bg-success-soft"
                  : certState === "expiring"
                  ? "bg-warning-soft"
                  : "bg-danger-soft"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  certState === "ok"
                    ? "text-success-text"
                    : certState === "expiring"
                    ? "text-warning-text"
                    : "text-danger-text"
                }`}
              >
                {certState === "ok"
                  ? t("vn.certOk")
                  : certState === "expiring"
                  ? t("vn.certExpiring")
                  : t("vn.certExpired")}
              </p>
              <p className="text-xs text-neutral mt-1">
                {me.certification_name} · {day(me.certification_expiry)}
              </p>
            </div>
          )}
        </Section>
      </Card>

      <Card title={t("calendar.title")}>
        <Section loading={loading} onRetry={onRetry}>
          <MiniCalendar events={calendar} />
        </Section>
      </Card>

      <Card title={t("vn.contracts")} wide>
        <Section loading={loading} error={errors.contracts} onRetry={onRetry} skeleton={<LoadingSkeleton rows={3} />}>
          <DataTable
            rows={data.contracts || []}
            columns={[
              { key: "title", header: t("th.title"), value: (r) => r.title },
              { key: "status", header: t("th.status"), value: (r) => r.status,
                render: (r) => <StatusPill value={r.status} /> },
              { key: "expiry", header: t("th.expiry"), value: (r) => day(r.expiry_date) },
            ]}
            empty={<EmptyState icon="📃" title="No contracts." />}
          />
        </Section>
      </Card>
    </>
  );
}
