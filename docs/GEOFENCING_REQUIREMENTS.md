# Geofencing Requirement

## Overview

The attendance punch experience must prevent check-in/check-out actions unless the device is physically inside an approved perimeter. Today the client only captures GPS coordinates (`location-service.js` → `ConfirmPunchScreen`). This document introduces the missing requirement: enforce geofencing before allowing a punch.

## Functional Requirements

1. **Fence Definition**
   - Store one or more allowed zones (circle radius or polygon) per organization/worksite.
   - Fetch the active fence(s) before starting location tracking. Cache locally but refresh daily or when org changes to avoid repeated downloads.
   - Client flow: API call (e.g., `/org/{id}/geofences`) → persist in Redux/secure storage → hydrate when launching attendance screens.

2. **Location Monitoring**
   - Continue using the existing `watchUserLocation` stream via `@react-native-community/geolocation` for near-real-time coordinates.
   - Every update must be evaluated against all active fences via point-in-circle or point-in-polygon math implemented in a reusable helper (e.g., `isWithinFence(coords, fence)`).
   - Debounce noisy readings (e.g., require 2 successive in-fence samples before changing state).
   - Battery guidance:
     - Increase `distanceFilter` (5–10 meters) so the OS only delivers updates when the user moves.
     - Consider a 10–15s interval unless a tighter SLA is mandated.
     - Stop the watcher as soon as the punch completes or screen blurs; restart when returning.
     - Investigate “significant change” APIs (iOS) / fused providers (Android) if we need even lower drain.

3. **Punch Eligibility**
   - While outside every fence, disable the confirm button and show guidance (“Move inside the permitted zone to punch”).
   - When inside, enable the button and include metadata showing which fence validated the punch (fence ID/name).
   - UI should refresh automatically when the watcher reclassifies the user as inside/outside.

4. **Event Logging**
   - Log enter/exit timestamps for auditing (local DB + optional API call).
   - Emit a warning event if a user attempts to punch outside the fence.
   - Punch payload must always include raw coordinates and the ID of the fence that approved the action so the backend can re-validate.
   - Continuous streaming of fence transitions to the server is optional; enable only if compliance teams request real-time feeds.

5. **Edge Cases**
   - Handle permission denial, GPS off, or stale fence definitions by blocking the punch with actionable messaging.
   - Provide a manual override flag (remote-config) for admins to bypass fences during outages.

## Non-Functional Requirements

- Keep battery impact minimal; reuse existing watch interval (5s) unless a tighter SLA is mandated.
- Ensure all geofence math runs client-side to allow instant feedback, but design API contracts so the server can re-validate punches using the coordinates + fence ID.
- Document tests: unit tests for geometry helpers, integration tests simulating enter/exit flows on `ConfirmPunchScreen`.

## Open Questions

1. Where should fence definitions live (mobile bundle vs. remote config vs. attendance API)?
2. Do we require multiple nested fences (HQ campus + building-level) or just one per user?
3. Should the app display the fence on `AppMap` for transparency?
4. Should we store fence enter/exit events locally only, or also sync them periodically to the server for analytics?

## Implementation Notes

1. **Pull fence definitions**
   - On login or org switch, hit the geofence API and cache the response.
   - Expose a selector/hook (e.g., `useGeofences()`) so `ConfirmPunchScreen` can read the data synchronously.

2. **Evaluate coordinates**
   - Add a geometry utility (`geo-utils.ts`) with helpers `haversineDistance` and `pointInPolygon`.
   - `handleLocationUpdate` (in `ConfirmPunchScreen`) should call `getActiveFenceIdForCoords(coords)`.
   - Maintain local state `currentFenceId` and `isInsideFence` for rendering + eligibility logic.

3. **Throttle GPS usage**
   - Update `watchUserLocation` options: `distanceFilter: 5`, `interval: 10000`, `fastestInterval: 5000`.
   - Use `AppState`/navigation listeners to `Geolocation.clearWatch` when the screen is backgrounded.

4. **Punch submission**
   - Extend the punch payload with `fenceId` and `fenceName`.
   - Server validates by verifying the coordinates fall inside the same fence definition.

## Offline Flow

1. **Cache fences while online**
   - Persist the latest fence payload in the local DB/secure storage so geofence math works offline.
   - Track the `fencePayloadVersion` to know when to refresh once connectivity resumes.

2. **Allow offline punches**
   - Run the same inside/outside validation locally; if inside, save a punch record flagged as `needsSync`.
   - Store metadata: timestamp, coordinates, fence ID, device ID, app version, and a signature/hash for tamper detection.

3. **Resync logic**
   - Background job watches for connectivity → replays pending punches in chronological order.
   - On server ACK, mark the record as synced; on rejection, show an alert so the user/admin can resolve it.

## Anti-Mock & Integrity Controls

1. **Device policy**
   - For managed Android devices, push `DISALLOW_DEBUGGING_FEATURES` and `DISALLOW_CONFIG_MOCK_LOCATION` via DevicePolicyManager or MDM so users cannot enable mock locations or USB debugging.
   - Require PIN/biometric lock on devices so policy changes need admin credentials.

2. **Runtime detection**
   - Check `Settings.Secure.ALLOW_MOCK_LOCATION`, inspect installed packages for known spoofing apps, and compare GPS vs. network/BLE readings.
   - Use Google Play Integrity/SafetyNet to detect rooted or tampered devices; block punches or flag them for review when signals fail.

3. **Server-side heuristics**
   - Validate that incoming coordinates align with historical behavior, expected travel speed, nearby Wi‑Fi/cell info, or optional BLE beacons.
   - Alert admins if impossible jumps or repeated mock signals occur.

4. **Operational safeguards**
   - Document that offline punches and mock-detection warnings are audited.
   - Provide tooling for security teams to review suspicious punches and take action (e.g., revoke device access).

Following these steps enforces the geofence requirement, keeps UX responsive (online or offline), minimizes battery drain, and raises the bar against mocked locations.

