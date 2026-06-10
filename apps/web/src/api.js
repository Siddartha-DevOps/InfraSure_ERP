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
