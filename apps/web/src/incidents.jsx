// Incident-logs module: safety incident register with severity breakdown,
// status workflow, and inline status actions for authorised roles.
import { Card, StatusPill, Button } from "./ui.jsx";
import { EmptyState, Section } from "./widgets.jsx";
import { useI18n } from "./i18n.jsx";

// Severity → colour tone for the breakdown tiles.
const SEVERITY_META = {
  CRITICAL: { tone: "text-danger-text", key: "inc.sev.CRITICAL" },
  HIGH: { tone: "text-danger-text", key: "inc.sev.HIGH" },
  MEDIUM: { tone: "text-warning-text", key: "inc.sev.MEDIUM" },
  LOW: { tone: "text-neutral", key: "inc.sev.LOW" },
};

// The status workflow: OPEN → INVESTIGATING → RESOLVED → CLOSED.
const NEXT_STATUS = {
  OPEN: "INVESTIGATING",
  INVESTIGATING: "RESOLVED",
  RESOLVED: "CLOSED",
};

const day = (iso) => (iso || "").slice(0, 10);

export function IncidentsModule({ data, loading, errors = {}, onRetry, canAct, mutate }) {
  const { t } = useI18n();
  const incidents = data.incidents || [];

  const open = incidents.filter((i) => i.status === "OPEN" || i.status === "INVESTIGATING").length;
  const sevCounts = {
    CRITICAL: incidents.filter((i) => i.severity === "CRITICAL").length,
    HIGH: incidents.filter((i) => i.severity === "HIGH").length,
    MEDIUM: incidents.filter((i) => i.severity === "MEDIUM").length,
    LOW: incidents.filter((i) => i.severity === "LOW").length,
  };

  return (
    <>
      <Card title={t("inc.title")} wide>
        <Section
          loading={loading}
          error={errors.incidents}
          onRetry={onRetry}
          empty={incidents.length === 0 && <EmptyState icon="🦺" title={t("inc.empty")} />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-surface rounded-lg p-4 text-center">
              <p className="text-3xl font-semibold text-primary">{open}</p>
              <p className="text-xs text-neutral">{t("inc.open")}</p>
            </div>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => {
              const m = SEVERITY_META[s];
              return (
                <div key={s} className="bg-surface rounded-lg p-4 text-center">
                  <p className={`text-3xl font-semibold ${m.tone}`}>{sevCounts[s]}</p>
                  <p className="text-xs text-neutral">{t(m.key)}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </Card>

      <Card title={t("inc.registry")} wide>
        <Section loading={loading} error={errors.incidents} onRetry={onRetry}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-neutral">
                <th scope="col" className="py-1 font-medium">{t("inc.th.date")}</th>
                <th scope="col" className="font-medium">{t("inc.th.title")}</th>
                <th scope="col" className="font-medium">{t("inc.th.category")}</th>
                <th scope="col" className="font-medium">{t("inc.th.severity")}</th>
                <th scope="col" className="font-medium">{t("inc.th.site")}</th>
                <th scope="col" className="font-medium">{t("inc.th.status")}</th>
                {canAct && <th></th>}
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => {
                const sev = SEVERITY_META[i.severity] || SEVERITY_META.LOW;
                const next = NEXT_STATUS[i.status];
                return (
                  <tr key={i.incident_id} className="border-t border-gray-100 align-top">
                    <td className="py-2 whitespace-nowrap">{day(i.occurred_at)}</td>
                    <td className="font-medium">{i.title}</td>
                    <td>{t(`inc.cat.${i.category}`)}</td>
                    <td className={`font-medium ${sev.tone}`}>{t(sev.key)}</td>
                    <td>{i.site_name || "—"}</td>
                    <td><StatusPill value={i.status} /></td>
                    {canAct && (
                      <td>
                        {next && (
                          <button
                            onClick={() =>
                              mutate(
                                `mutation($t:ID!,$id:ID!,$s:String!){updateIncidentStatus(tenant_id:$t,incident_id:$id,status:$s){incident_id}}`,
                                { id: i.incident_id, s: next }
                              )
                            }
                            className="text-primary underline text-xs whitespace-nowrap"
                          >
                            {t(`inc.advance.${next}`)}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      </Card>
    </>
  );
}
