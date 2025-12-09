# Aadhaar Face RD and OTP Authentication Guide

## Overview

This guide explains how Aadhaar Face RD (Face Recognition Device) and OTP authentication is implemented in the app.

## Flow Diagram

```
User Enters Aadhaar Number
    ↓
Platform Check
    ├─ iOS → OTP Screen (Face RD not available on iOS)
    └─ Android → Face RD Authentication
        ├─ Success → Store Aadhaar → Navigate to CheckInScreen
        └─ Failure → OTP Screen (Fallback)
            └─ OTP Success → Store Aadhaar → Navigate to CheckInScreen
```

## Implementation Details

### 1. Aadhaar Input Screen (`AadhaarInputScreen.tsx`)

**Purpose:** Capture Aadhaar number and initiate authentication

**Key Functions:**
- `formatAadhaar()`: Formats input as XXXX XXXX XXXX
- `onCaptureFacePress()`: Initiates Face RD (Android) or OTP (iOS)
- `onStoreAadhaarData()`: Stores Aadhaar after successful verification

**Event Listeners:**
- `FaceAuthSuccess`: Triggered when Face RD succeeds
- `FaceAuthFailure`: Triggered when Face RD fails

### 2. Face RD Service (`aadhaar-facerd-service.ts`)

**Purpose:** Interface with native UIDAI Face RD module

**Key Functions:**
- `startFaceAuth(aadhaarNo)`: Calls native Face RD module
- `storeAadhaarNumber()`: Stores encrypted Aadhaar in Keychain
- `checkAadhaarDataAvailability()`: Checks if Aadhaar is stored

**Error Handling:**
- `ERROR_MESSAGES`: Maps error codes to user-friendly messages
- Common errors: service_not_installed, capture_failed, network_issue

### 3. OTP Screen (`OtpScreen.tsx`)

**Purpose:** Handle OTP verification as fallback for Face RD

**Flow Types:**
- `isAadhaarFallback: true`: OTP for Aadhaar verification
- `isPunchFlow: true`: OTP for punch verification (after biometric)

## Best Practices

### 1. Error Handling

```typescript
// Always handle Face RD errors gracefully
const failureListener = DeviceEventEmitter.addListener(
  'FaceAuthFailure',
  (error: any) => {
    // Log error for debugging
    console.log('Face RD Failure:', error);
    
    // Show user-friendly message
    // Navigate to OTP fallback
  }
);
```

### 2. Event Listener Cleanup

```typescript
// Always remove listeners on unmount
useEffect(() => {
  const successListener = DeviceEventEmitter.addListener(...);
  const failureListener = DeviceEventEmitter.addListener(...);
  
  return () => {
    successListener.remove();
    failureListener.remove();
  };
}, [dependencies]);
```

### 3. State Management

- Store Aadhaar number in Redux: `storedAadhaarNumber`
- Track verification status: `isAadhaarFaceValidated`
- Track last verification date: `lastAadhaarVerificationDate`

### 4. Security

- Aadhaar number is encrypted before storing in Keychain
- Never log full Aadhaar number
- Clear Aadhaar from memory after use

## Common Issues and Solutions

### Issue 1: Face RD Not Triggering

**Symptoms:** Button press doesn't trigger Face RD prompt

**Solutions:**
- Check if native module is linked: `FaceAuth` should exist
- Verify UIDAI RD Service is installed on device
- Check Android permissions in manifest
- Ensure Aadhaar number is valid (12 digits)

### Issue 2: Event Listeners Not Firing

**Symptoms:** Success/failure events not received

**Solutions:**
- Ensure listeners are set up before calling `startFaceAuth()`
- Check dependency array in `useEffect`
- Verify event names match: `FaceAuthSuccess`, `FaceAuthFailure`
- Check if component unmounted before event fired

### Issue 3: OTP Not Working After Face RD Failure

**Symptoms:** Navigation to OTP screen fails

**Solutions:**
- Ensure `isAadhaarFallback: true` is passed
- Verify Aadhaar number is passed to OTP screen
- Check navigation params are correct
- Ensure OTP screen handles `isAadhaarFallback` flow

### Issue 4: Aadhaar Not Stored After Verification

**Symptoms:** Aadhaar number lost after app restart

**Solutions:**
- Verify `setStoredAadhaarNumber()` is called on success
- Check Redux persistence is configured
- Verify Keychain storage is working
- Check if `storeAadhaarNumber()` is called

## Testing Checklist

- [ ] Face RD works on Android device with UIDAI RD Service
- [ ] Face RD failure navigates to OTP screen
- [ ] OTP verification works after Face RD failure
- [ ] Aadhaar number is stored after successful verification
- [ ] Aadhaar verification persists across app restarts
- [ ] iOS falls back to OTP correctly
- [ ] Error messages are user-friendly
- [ ] Event listeners are properly cleaned up

## API Integration (TODO)

Currently, OTP verification has TODO comments. To complete:

1. **Create OTP API Service:**
```typescript
// services/auth/otp-service.ts
export async function verifyOTP(email: string, otp: string, aadhaarNumber?: string): Promise<boolean> {
  // Call backend API to verify OTP
  // Return true if verified, false otherwise
}
```

2. **Update OtpScreen:**
```typescript
const onConfirmButtonPress = async () => {
  const isValid = await verifyOTP(emailID, otpValue, aadhaarNumber);
  if (isValid) {
    // Proceed with flow
  } else {
    // Show error
  }
};
```

3. **Handle Backend Response:**
- Success: Proceed with navigation
- Failure: Show error message, allow retry
- Network error: Show offline message

## Security Considerations

1. **Never store Aadhaar in plain text**
2. **Use encryption for Keychain storage**
3. **Validate Aadhaar format before sending**
4. **Implement rate limiting for OTP requests**
5. **Log authentication attempts for audit**
6. **Clear sensitive data from memory**

## Native Module Requirements

### Android
- UIDAI RD Service APK must be installed
- Face RD native module must be linked
- Proper permissions in AndroidManifest.xml

### iOS
- Face RD not available (use OTP only)
- Face ID can be used for device biometric (separate from Aadhaar Face RD)

