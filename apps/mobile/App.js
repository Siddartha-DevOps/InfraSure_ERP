import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import {
  login as apiLogin,
  logout as apiLogout,
  queueDPR,
  getQueue,
  flushQueue,
} from "./src/api";

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("engineer@demo.test");
  const [password, setPassword] = useState("Passw0rd!");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const session = await apiLogin(email, password);
      onLogin(session);
    } catch (e) {
      Alert.alert("Login failed", e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>InfraSure Field</Text>
      <Text style={styles.subtitle}>Geo-tagged Daily Progress Reports</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholder="Email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
      />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function DPRScreen({ session, onLogout }) {
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    getQueue().then((q) => setQueueCount(q.length));
  }, []);

  async function captureLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Location is required to geo-tag reports.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera is required to attach site photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  // Always queue locally first (offline-first); then try to flush to the server.
  async function submitDPR() {
    if (!coords) {
      Alert.alert("Geo-tag required", "Capture your location before submitting.");
      return;
    }
    const entry = {
      note,
      location: coords,
      photo_uri: photoUri,
      reported_by: session.user.email,
    };
    const count = await queueDPR(entry);
    setQueueCount(count);
    setNote("");
    setPhotoUri(null);

    const { submitted, remaining } = await flushQueue(session.user.tenant_id);
    setQueueCount(remaining);
    Alert.alert(
      "DPR saved",
      submitted > 0
        ? `Synced ${submitted} report(s). ${remaining} still queued.`
        : `Saved offline. ${remaining} report(s) queued for sync.`
    );
  }

  async function syncNow() {
    const { submitted, remaining } = await flushQueue(session.user.tenant_id);
    setQueueCount(remaining);
    Alert.alert("Sync", `Synced ${submitted}. ${remaining} remaining.`);
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily Progress Report</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.link}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Work completed, blockers, manpower…"
      />

      <TouchableOpacity style={styles.secondary} onPress={captureLocation}>
        <Text style={styles.secondaryText}>
          {coords
            ? `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
            : "Capture location"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondary} onPress={takePhoto}>
        <Text style={styles.secondaryText}>
          {photoUri ? "📷 Photo attached" : "Take site photo"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={submitDPR}>
        <Text style={styles.buttonText}>Submit DPR</Text>
      </TouchableOpacity>

      <View style={styles.queueRow}>
        <Text style={styles.queueText}>{queueCount} report(s) queued offline</Text>
        {queueCount > 0 && (
          <TouchableOpacity onPress={syncNow}>
            <Text style={styles.link}>Sync now</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {session ? (
        <DPRScreen
          session={session}
          onLogout={async () => {
            await apiLogout();
            setSession(null);
          }}
        />
      ) : (
        <LoginScreen onLogin={setSession} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  body: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "700", color: "#1e293b" },
  subtitle: { color: "#64748b", marginBottom: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1e293b" },
  label: { color: "#475569", marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  multiline: { height: 100, textAlignVertical: "top" },
  button: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondary: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  secondaryText: { color: "#334155", fontWeight: "600" },
  queueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  queueText: { color: "#64748b" },
  link: { color: "#2563eb", fontWeight: "600" },
});
