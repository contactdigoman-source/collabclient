# App Flow & Data Sync Overview

This document captures the current high-level flow for the attendance app, the state management hand-offs (Redux vs. TanStack Query), and the offline/online sync plan.

## Screen Flow (Stack Order)

1. **Login (`LoginScreen`)**
   - User authenticates (OAuth/mobile OTP) and we fetch the org profile + feature flags.
   - From here users may branch to `ForgotPasswordScreen` → `ChangeForgottenPassword` → back to login.
   - On success, bootstrap Redux with user/session data and cached geofence payload (see `GEOFENCING_REQUIREMENTS.md`).

2. **Privacy Consent (`PrivacyPolicyScreen`)**
   - Immediately after login, show the privacy disclosure screen.
   - Store consent status in Redux (`userState.consentStatus`) and persist to disk so we can skip on future launches.

3. **Aadhaar Number Capture (`AadhaarInputScreen`)**
   - Screen validates Aadhaar format locally, then calls the backend to initiate eKYC.
   - Persist partial Aadhaar entry + request IDs in Redux until the flow completes. Clear on success/failure to avoid leaks.

4. **Face RD Verification / (Future) OTP fallback**
   - Launch the Face RD SDK to perform biometric auth.
   - If the SDK returns success, mark `kyc.faceStatus = verified` in Redux and continue to Home.
   - Current build: when Face RD fails, the flow stops here (no fallback implemented yet).
   - Requirement gap: add a new OTP screen for this path. The existing `OtpScreen` is wired only to `ForgotPasswordScreen` → `ChangeForgottenPassword`, so we cannot reuse it without additional props/routes.

5. **Dashboard (`DashboardScreen`)**
   - Hosts the curved bottom tab bar with `HomeTab` (Home screen) and `DaysTab` (Days bottom-tab screen).
   - Long-pressing the center Punch FAB navigates to `ConfirmPunchScreen`.
   - Drawer/utility screens accessible from here:
     - `ProfileDrawerScreen` → `ViewProfileScreen`
     - `AttendanceLogsScreen`

6. **Confirm Punch (`ConfirmPunchScreen`)**
   - Requires location permission, shows map, enforces geofence, and triggers punch mutations.

## State Responsibilities

| Layer | Examples | Notes |
| --- | --- | --- |
| Redux | session info, consent flag, Aadhaar flow status, geofence cache, current location, last punch record | Chosen for deterministic local state shared across multiple components/screens. |
| TanStack Query | punch check-in/out mutations, sync of offline punches, fetching attendance history | Provides request caching, retries, and offline mutation queues. |

Flow: Login seeds Redux; privacy/Aadhaar/Face RD update Redux slices; once Home loads, punch mutations are issued via TanStack Query (`useMutation` with `networkMode: 'offlineFirst'`) while Redux keeps immediate UI state (e.g., `userLocationRegion`, `isInsideFence`).

## Navigation Map

- **Stack Navigator (see `src/navigation/index.js`):**
  - `LoginScreen`
  - `ForgotPasswordScreen`
  - `ChangeForgottenPassword`
  - `PrivacyPolicyScreen`
  - `AadhaarInputScreen`
  - `OtpScreen`
  - `DashboardScreen`
  - `ConfirmPunchScreen`
  - `ProfileDrawerScreen`
  - `AttendanceLogsScreen`
  - `ViewProfileScreen`

- **Dashboard (`BottomTabBar.js`):**
  - Curved bottom tabs
    - `HomeTab` → `HomeScreen`
    - `DaysTab` → `DaysBottomTabScreen`
  - Center FAB: opens `ConfirmPunchScreen` after permission checks.
  - Drawer/shortcuts from Home: profile view, attendance logs, settings, etc.

## Punch + Location Handling

1. **Location acquisition**
   - `location-service.js` streams GPS updates into Redux.
   - Geofence evaluation runs locally (see requirements doc) to set `punchState.canPunch`.

2. **Punch mutation**
   - Button press triggers a TanStack Query mutation that:
     - Writes the payload (timestamp, coords, fence ID, direction) to the offline queue/local DB.
     - Attempts immediate sync; if offline, mutation stays pending until reconnect.
   - Redux is updated optimistically so the UI reflects the new punch status instantly.

3. **Sync + Conflict resolution**
   - TanStack Query retries pending mutations when network returns.
   - On success, mark the local DB entry as synced; on failure (conflict), dispatch a Redux action to show an alert or request manual resolution.

## Failure Handling

- **Face RD failure:** offer OTP fallback, capture the OTP verification result in Redux, and log the failure reason for audit.
- **Network loss before Home:** keep login session, but block navigation past privacy/Aadhaar steps until minimal data is fetched or cached.
- **Punch without connectivity:** location/geofence still run locally; mutation is enqueued for later sync.

## Next Steps

1. Document the exact Redux slices used in each screen (appendix).
2. Implement TanStack Query mutations for punch-in/out with `offlineRetry` + local persistence.
3. Add analytics hooks at each stage (login, consent, Aadhaar, Face RD, OTP, punch).

This flow ensures the user journey is deterministic, supports biometric fallback, enforces geofencing, and keeps attendance data consistent even when offline.

