// Minimal GraphQL client for the InfraSure ERP web shell.
const ENDPOINT =
  import.meta.env.VITE_API_URL || "http://localhost:4000/graphql";

export async function gql(query, variables = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// REST origin (GraphQL endpoint minus the /graphql path) for file uploads.
const API_ORIGIN = ENDPOINT.replace(/\/graphql$/, "");

// Upload a contract document via the REST endpoint (multipart/form-data).
export async function uploadContractDocument(contractId, tenantId, file) {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("file", file);
  form.append("tenant_id", tenantId);
  const res = await fetch(
    `${API_ORIGIN}/api/contracts/${contractId}/document`,
    {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json;
}

export { API_ORIGIN };
