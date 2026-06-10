// Minimal GraphQL + offline-queue client for the InfraSure field app.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const ENDPOINT =
  Constants.expoConfig?.extra?.apiUrl || "http://localhost:4000/graphql";
const QUEUE_KEY = "infrasure.dpr.queue";

export async function gql(query, variables = {}) {
  const token = await AsyncStorage.getItem("token");
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

export async function login(email, password) {
  const data = await gql(
    `mutation($email:String!,$password:String!){
      login(email:$email,password:$password){
        token user{user_id email role tenant_id}
      }
    }`,
    { email, password }
  );
  await AsyncStorage.setItem("token", data.login.token);
  return data.login;
}

// --- Offline queue: DPRs captured offline are stored and flushed when online. ---

export async function queueDPR(entry) {
  const queue = await getQueue();
  queue.push({ ...entry, queued_at: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

export async function getQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Attempts to submit every queued DPR; keeps the ones that fail (still offline).
export async function flushQueue(tenant_id) {
  const queue = await getQueue();
  const remaining = [];
  for (const entry of queue) {
    try {
      await gql(
        `mutation($t:ID!,$data:String!){createDPR(tenant_id:$t,report_data:$data){dpr_id}}`,
        { t: tenant_id, data: JSON.stringify(entry) }
      );
    } catch {
      remaining.push(entry); // still offline / failed — retry next flush
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { submitted: queue.length - remaining.length, remaining: remaining.length };
}

export async function logout() {
  await AsyncStorage.removeItem("token");
}
