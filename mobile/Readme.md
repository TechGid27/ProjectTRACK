# ProjectTrack Mobile Client

The mobile field application provides ground-truth audit capabilities, mandatory geospatial proximity verification, and offline-first documentation for civil works projects across Cebu Province.

Built with **React Native and Expo**, the application leverages native device sensors (GPS and camera hardware) while maintaining cross-platform compatibility across Android and iOS.

---

## Technical Overview

* **Framework**: React Native with Expo (Expo SDK)
* **Geospatial & Geofencing**: `expo-location` with Haversine distance validation
* **Camera Hardware Integration**: `expo-camera` with shutter lockout controls
* **Local Persistence**: `expo-sqlite` for transactional offline queue storage
* **Background Tasks**: `expo-task-manager` and `expo-background-fetch`
* **File & Cryptographic Integrity**: `expo-file-system` and `expo-crypto` (SHA-256 verification)
* **Application Services**: Expo Application Services (EAS Build & Update)

---

## Core Capabilities

### 1. Geofenced Photo Capture (`expo-camera` + `expo-location`)
* Enforces strict physical presence verification before camera shutter actuation.
* The client queries hardware GPS coordinates via `expo-location` with highest accuracy (`LocationAccuracy.Highest`) and calculates the distance to the target DPWH project centroid. If the device is outside the configured threshold (e.g., 100 meters), shutter triggers are programmatically locked, preventing off-site fraudulent reporting.

### 2. Offline-First Background Sync (`expo-sqlite` + `expo-background-fetch`)
* Designed for remote rural and mountainous areas in Cebu with intermittent or absent cellular reception.
* Audit reports, timestamps, coordinates, and photo paths are stored in an encrypted local `expo-sqlite` database.
* An `expo-task-manager` background task listens for network connectivity restoration via NetInfo. Once an active connection is established, the queued records are drained transactionally to the backend gateway at `/api/pipeline/audit-sync`.

### 3. EXIF and Sensor Integrity
* Preserves raw camera sensor metadata, device orientation, and hardware GPS accuracy metrics.
* Calculates SHA-256 hashes of uncompressed captures via `expo-crypto` for server-side Error Level Analysis (ELA) and tamper verification.

---

## Local Development and Setup

### 1. Prerequisites
* Node.js 18 or higher with npm
* Mobile device with **Expo Go** installed (available on Google Play Store and Apple App Store), or a configured Android Emulator / iOS Simulator
* Expo CLI (`npx expo`)

### 2. Installation
```bash
cd Mobile
npm install
```

### 3. Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env
```
Ensure `API_BASE_URL` points to your backend instance.
* For Android Emulator: `http://10.0.2.2:8000/api`
* For iOS Simulator: `http://localhost:8000/api`
* For Physical Device via Expo Go: `http://<YOUR_LOCAL_IP>:8000/api`

### 4. Running with Expo
```bash
# Start the Expo development server
npx expo start

# Press 'a' in the terminal for Android Emulator
# Press 'i' in the terminal for iOS Simulator
# Or scan the generated QR code using the Expo Go mobile application
```

### 5. Development Builds (Native Code Integration)
To compile native development clients:
```bash
# Android native build
npx expo run:android

# iOS native build (macOS required)
npx expo run:ios
```

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `API_BASE_URL` | Endpoint of the ProjectTrack FastAPI backend | `http://10.0.2.2:8000/api` |
| `GEOFENCE_RADIUS_METERS` | Permitted distance from project centroid for valid capture | `100` |
| `MAX_OFFLINE_QUEUE_ITEMS` | Maximum cached reports allowed in SQLite before forced sync | `500` |
| `ENABLE_MOCK_GPS` | Flag allowing mock coordinates during testing | `false` |

---

## Production Builds (EAS)

ProjectTrack Mobile is packaged using Expo Application Services (EAS):

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Build Android APK / AAB
eas build --platform android --profile preview

# Build iOS IPA
eas build --platform ios --profile preview
```

---

## License

This package is part of the ProjectTrack open-source monorepo, licensed under the MIT License.
