# InfraSure Field (mobile)

React Native (Expo) field app for on-site compliance — **Phase 4**.

## Features

- **Login** against the same GraphQL API (`VITE`-independent; configured via
  `app.json` → `expo.extra.apiUrl`).
- **Geo-tagged DPRs** — capture GPS coordinates (`expo-location`) with each Daily
  Progress Report.
- **Site photos** — attach a camera photo (`expo-image-picker`).
- **Offline-first queue** — DPRs are saved locally (`AsyncStorage`) and flushed to the
  server (`createDPR`) when connectivity returns; failed submissions stay queued.

## Run

```bash
cd apps/mobile
npm install
npm start          # Expo dev server; open in Expo Go or a simulator
```

Point `expo.extra.apiUrl` in `app.json` at your API's `/graphql` URL (use your
machine's LAN IP, not `localhost`, when testing on a physical device).

> **Status:** scaffolded in Phase 4. It has **not** been built/run through the React
> Native toolchain in CI/dev here — validate with `npm install && npm start` locally
> (requires the Expo toolchain, an emulator or the Expo Go app).
