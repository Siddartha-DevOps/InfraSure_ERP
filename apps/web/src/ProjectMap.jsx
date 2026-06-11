// Interactive project-compliance map (Leaflet + OpenStreetMap tiles).
// CircleMarkers are pure SVG, so there's no Leaflet marker-icon asset issue.
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const STATUS_COLOR = {
  COMPLIANT: "#10B981",
  PENDING: "#F59E0B",
  NON_COMPLIANT: "#DC2626",
};

function center(sites) {
  if (!sites.length) return [20.5937, 78.9629]; // India
  const lat = sites.reduce((a, s) => a + s.latitude, 0) / sites.length;
  const lng = sites.reduce((a, s) => a + s.longitude, 0) / sites.length;
  return [lat, lng];
}

export function ProjectMap({ sites = [] }) {
  const { t } = useI18n();

  return (
    <Card title={t("map.title")} wide>
      {sites.length === 0 ? (
        <p className="text-sm text-neutral">{t("map.empty")}</p>
      ) : (
        <>
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <MapContainer
              center={center(sites)}
              zoom={5}
              style={{ height: 360, width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {sites.map((s) => (
                <CircleMarker
                  key={s.site_id}
                  center={[s.latitude, s.longitude]}
                  radius={10}
                  pathOptions={{
                    color: STATUS_COLOR[s.status] || "#6B7280",
                    fillColor: STATUS_COLOR[s.status] || "#6B7280",
                    fillOpacity: 0.7,
                    weight: 2,
                  }}
                >
                  <Tooltip>{s.name}</Tooltip>
                  <Popup>
                    <strong>{s.name}</strong>
                    <br />
                    {s.status.replace("_", " ")}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <Legend color="#10B981" label={`🟢 ${t("map.legend.compliant")}`} />
            <Legend color="#F59E0B" label={`🟡 ${t("map.legend.pending")}`} />
            <Legend color="#DC2626" label={`🔴 ${t("map.legend.noncompliant")}`} />
          </div>
        </>
      )}
    </Card>
  );
}

function Legend({ label }) {
  return <span className="text-gray-600">{label}</span>;
}
