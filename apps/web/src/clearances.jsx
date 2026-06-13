// Environmental clearances module: renewal roll-up (🟢/🟡/🔴) + register
// with a renew action. Renewal health is derived server-side from expiry_date.
import { Card } from "./ui.jsx";
import { EmptyState, Section } from "./widgets.jsx";
import { useI18n } from "./i18n.jsx";

const RENEWAL_META = {
  VALID: { dot: "🟢", tone: "text-success-text", key: "cl.valid" },
  EXPIRING: { dot: "🟡", tone: "text-warning-text", key: "cl.expiring" },
  EXPIRED: { dot: "🔴", tone: "text-danger-text", key: "cl.expired" },
};

const day = (iso) => (iso || "").slice(0, 10);

export function ClearanceModule({ data, loading, errors = {}, onRetry, canAct, onRenew }) {
  const { t } = useI18n();
  const clearances = data.clearances || [];
  const counts = {
    VALID: clearances.filter((c) => c.renewal_status === "VALID").length,
    EXPIRING: clearances.filter((c) => c.renewal_status === "EXPIRING").length,
    EXPIRED: clearances.filter((c) => c.renewal_status === "EXPIRED").length,
  };

  return (
    <>
      <Card title={t("cl.title")} wide>
        <Section
          loading={loading}
          error={errors.clearances}
          onRetry={onRetry}
          empty={clearances.length === 0 && <EmptyState icon="📜" title={t("cl.empty")} />}
        >
          <div className="grid grid-cols-3 gap-3">
            {["VALID", "EXPIRING", "EXPIRED"].map((s) => {
              const m = RENEWAL_META[s];
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

      <Card title={t("cl.registry")} wide>
        <Section loading={loading} error={errors.clearances} onRetry={onRetry}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-neutral">
                <th scope="col" className="py-1 font-medium">{t("cl.th.type")}</th>
                <th scope="col" className="font-medium">{t("cl.th.authority")}</th>
                <th scope="col" className="font-medium">{t("cl.th.reference")}</th>
                <th scope="col" className="font-medium">{t("cl.th.expiry")}</th>
                <th scope="col" className="font-medium">{t("cl.th.renewal")}</th>
                {canAct && <th></th>}
              </tr>
            </thead>
            <tbody>
              {clearances.map((c) => {
                const m = RENEWAL_META[c.renewal_status] || RENEWAL_META.VALID;
                return (
                  <tr key={c.clearance_id} className="border-t border-gray-100">
                    <td className="py-2">{t(`cl.type.${c.clearance_type}`)}</td>
                    <td>{c.authority || "—"}</td>
                    <td>{c.reference_no || "—"}</td>
                    <td className="whitespace-nowrap">{day(c.expiry_date)}</td>
                    <td className={`font-medium ${m.tone}`}>
                      <span aria-hidden="true">{m.dot}</span> {t(m.key)}
                    </td>
                    {canAct && (
                      <td>
                        <button
                          onClick={() => onRenew(c)}
                          className="text-primary underline text-xs whitespace-nowrap"
                        >
                          {t("cl.renew")}
                        </button>
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
