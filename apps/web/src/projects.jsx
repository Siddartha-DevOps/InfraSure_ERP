// Projects module: compliance roll-up overview (🟢/🟡/🔴) + project registry.
import { Card, StatusPill } from "./ui.jsx";
import { DataTable, EmptyState, Section } from "./widgets.jsx";
import { useI18n } from "./i18n.jsx";

const STATUS_META = {
  COMPLIANT: { dot: "🟢", tone: "text-success-text", key: "pj.compliant" },
  PENDING: { dot: "🟡", tone: "text-warning-text", key: "pj.pending" },
  NON_COMPLIANT: { dot: "🔴", tone: "text-danger-text", key: "pj.noncompliant" },
};

export function ProjectsModule({ data, loading, errors = {}, onRetry }) {
  const { t } = useI18n();
  const projects = data.projects || [];
  const counts = {
    COMPLIANT: projects.filter((p) => p.compliance_status === "COMPLIANT").length,
    PENDING: projects.filter((p) => p.compliance_status === "PENDING").length,
    NON_COMPLIANT: projects.filter((p) => p.compliance_status === "NON_COMPLIANT").length,
  };

  return (
    <>
      <Card title={t("pj.title")} wide>
        <Section
          loading={loading}
          error={errors.projects}
          onRetry={onRetry}
          empty={projects.length === 0 && <EmptyState icon="🏗️" title={t("pj.empty")} />}
        >
          <div className="grid grid-cols-3 gap-3">
            {["COMPLIANT", "PENDING", "NON_COMPLIANT"].map((s) => {
              const m = STATUS_META[s];
              return (
                <div key={s} className="bg-surface rounded-lg p-4 text-center">
                  <div className="text-2xl" aria-hidden="true">{m.dot}</div>
                  <p className={`text-3xl font-semibold ${m.tone}`}>{counts[s]}</p>
                  <p className="text-xs text-neutral">{t(m.key)}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </Card>

      <Card title={t("pj.registry")} wide>
        <Section loading={loading} error={errors.projects} onRetry={onRetry}>
          <DataTable
            rows={projects}
            columns={[
              { key: "code", header: t("pj.code"), value: (r) => r.code },
              { key: "name", header: t("pj.name"), value: (r) => r.name },
              { key: "loc", header: t("pj.location"), value: (r) => r.location || "—" },
              { key: "contracts", header: t("pj.contracts"), value: (r) => r.contract_count },
              { key: "sites", header: t("pj.sites"), value: (r) => r.site_count },
              {
                key: "status", header: t("pj.health"), value: (r) => r.compliance_status,
                render: (r) => {
                  const m = STATUS_META[r.compliance_status] || STATUS_META.PENDING;
                  return (
                    <span className={`font-medium ${m.tone}`}>
                      <span aria-hidden="true">{m.dot}</span> {t(m.key)}
                    </span>
                  );
                },
              },
            ]}
            empty={<EmptyState icon="🏗️" title={t("pj.empty")} />}
          />
        </Section>
      </Card>
    </>
  );
}
