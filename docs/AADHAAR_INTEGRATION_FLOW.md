# Aadhaar Integration Flow - Official RD App vs OTP

This document explains how to integrate with the official UIDAI RD app and fallback to OTP authentication.

## Flow Overview

```
User Enters Aadhaar Number
    ↓
Check UIDAI RD Service Availability
    ├─ Available → Use Face RD Authentication
    │   ├─ Success → Store Aadhaar → Navigate to CheckInScreen
    │   └─ Failure → Fallback to OTP
    └─ Not Available → Direct OTP Authentication
        └─ OTP Success → Store Aadhaar → Navigate to CheckInScreen
```

## Scenario 1: Official UIDAI RD App Available

### Step 1: Check RD Service Availability

```typescript
// In AadhaarInputScreen.tsx or service
import { NativeModules, Platform } from 'react-native';

const checkRDServiceAvailable = (): boolean => {
  if (Platform.OS !== 'android') {
    return false; // iOS doesn't support RD Service
  }
  
  const { FaceAuth } = NativeModules;
  if (!FaceAuth) {
    return false; // Native module not implemented
  }
  
  // Check if UIDAI RD Service is installed
  // This check happens in native module
  return true; // Assume available, native module will verify
};
```

### Step 2: Start Face RD Authentication

```typescript
// In AadhaarInputScreen.tsx
const onCaptureFacePress = useCallback((): void => {
  const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
  if (rawAadhaar?.length !== AADHAAR_LENGTH) {
    setAadhaarNumberErr(t('aadhaar.aadhaarLengthError'));
    return;
  }

  setAadhaarNumberErr('');
  
  if (Platform.OS === 'android') {
    // Check if RD Service is available
    const { FaceAuth } = NativeModules;
    
    if (FaceAuth && checkRDServiceAvailable()) {
      // Use Face RD
      dispatch(setIsAuthenticatingFace(true));
      
      if (__DEV__) {
        // Dev mode: Skip Face RD
        dispatch(setIsAadhaarFaceValidated(true));
        const rawAadhaarForStorage = getRawAadhaarNumber(aadhaarInput);
        dispatch(setStoredAadhaarNumber(rawAadhaarForStorage));
      } else {
        // Production: Start Face RD
        startFaceAuth(rawAadhaar);
      }
    } else {
      // RD Service not available, fallback to OTP
      navigateToOTPScreen(rawAadhaar);
    }
  } else {
    // iOS: Use OTP directly
    navigateToOTPScreen(rawAadhaar);
  }
}, [aadhaarInput, dispatch, t, navigation]);

const navigateToOTPScreen = (rawAadhaar: string) => {
  navigation.navigate('OtpScreen', {
    emailID: store.getState().userState?.userData?.email || '',
    isAadhaarFallback: true,
    aadhaarNumber: rawAadhaar,
  });
};
```

### Step 3: Handle Face RD Success/Failure

```typescript
// Event listeners in AadhaarInputScreen.tsx
useEffect(() => {
  if (Platform.OS !== 'android') {
    return;
  }

  const successListener = DeviceEventEmitter.addListener(
    'FaceAuthSuccess',
    (data: any) => {
      console.log('Face RD Success:', data);
      dispatch(setIsAuthenticatingFace(false));
      dispatch(setIsAadhaarFaceValidated(true));
      
      // Store Aadhaar number
      const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
      if (rawAadhaar && rawAadhaar.length === AADHAAR_LENGTH) {
        dispatch(setStoredAadhaarNumber(rawAadhaar));
      }
    },
  );

  const failureListener = DeviceEventEmitter.addListener(
    'FaceAuthFailure',
    (error: any) => {
      console.log('Face RD Failure:', error);
      dispatch(setIsAuthenticatingFace(false));
      
      // Fallback to OTP
      const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
      if (rawAadhaar && rawAadhaar.length === AADHAAR_LENGTH) {
        navigation.navigate('OtpScreen', {
          emailID: store.getState().userState?.userData?.email || '',
          isAadhaarFallback: true,
          aadhaarNumber: rawAadhaar,
        });
      } else {
        setAadhaarNumberErr(t('aadhaar.aadhaarLengthError'));
      }
    },
  );

  return () => {
    successListener.remove();
    failureListener.remove();
  };
}, [dispatch, navigation, aadhaarInput, t]);
```

## Scenario 2: OTP Authentication (Fallback or Primary)

### Step 1: Navigate to OTP Screen

```typescript
// When RD Service is not available or Face RD fails
navigation.navigate('OtpScreen', {
  emailID: store.getState().userState?.userData?.email || '',
  isAadhaarFallback: true,  // Important flag
  aadhaarNumber: rawAadhaar, // Pass Aadhaar number
});
```

### Step 2: Request OTP from Backend

```typescript
// In OtpScreen.tsx or API service
// TODO: Implement API call to request OTP

interface RequestOTPParams {
  aadhaarNumber: string;
  emailID: string;
}

const requestAadhaarOTP = async (params: RequestOTPParams): Promise<boolean> => {
  try {
    // Call your backend API
    const response = await axios.post('/api/aadhaar/request-otp', {
      aadhaarNumber: params.aadhaarNumber,
      emailID: params.emailID,
    });
    
    if (response.data.success) {
      // OTP sent successfully
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to request OTP:', error);
    return false;
  }
};
```

**Backend API Endpoint (Example):**
```javascript
// Backend: POST /api/aadhaar/request-otp
// This should call UIDAI OTP API or third-party service
{
  "aadhaarNumber": "123456789012",
  "emailID": "user@example.com"
}

// Response:
{
  "success": true,
  "message": "OTP sent successfully"
}
```

### Step 3: Verify OTP

```typescript
// In OtpScreen.tsx - onConfirmButtonPress
const onConfirmButtonPress = useCallback(async (): Promise<void> => {
  if (otpValue.trim().length !== 6) {
    setOtpError(t('otp.invalidOtp'));
    return;
  }

  if (isAadhaarFallback) {
    // Verify OTP with backend
    try {
      setIsVerifying(true);
      setOtpError('');
      
      // TODO: Call backend API to verify OTP
      const isValid = await verifyAadhaarOTP({
        aadhaarNumber: aadhaarNumber || '',
        otp: otpValue,
        emailID: emailID,
      });
      
      if (isValid) {
        // OTP verified successfully
        // Store Aadhaar number
        if (aadhaarNumber) {
          dispatch(setStoredAadhaarNumber(aadhaarNumber));
        }
        
        // Mark Aadhaar as validated
        dispatch(setUserAadhaarFaceValidated(true));
        await storeAadhaarNumber();
        
        // Navigate to location capture
        const onCancelPress = (): void => {
          navigation.replace('DashboardScreen');
        };
        
        const granted = await requestLocationPermission(onCancelPress);
        
        if (granted) {
          const isLocationOn = await isLocationEnabled();
          if (isLocationOn) {
            navigation.replace('CheckInScreen');
          } else {
            navigation.replace('DashboardScreen');
          }
        } else {
          navigation.replace('DashboardScreen');
        }
      } else {
        // Invalid OTP
        setOtpError(t('otp.invalidOtp'));
      }
    } catch (error) {
      console.error('OTP verification failed:', error);
      setOtpError(t('otp.verificationFailed'));
    } finally {
      setIsVerifying(false);
    }
  }
  // ... other flows
}, [otpValue, isAadhaarFallback, aadhaarNumber, emailID, dispatch, navigation, t]);
```

**Backend API Endpoint (Example):**
```javascript
// Backend: POST /api/aadhaar/verify-otp
{
  "aadhaarNumber": "123456789012",
  "otp": "123456",
  "emailID": "user@example.com"
}

// Response:
{
  "success": true,
  "verified": true,
  "message": "Aadhaar verified successfully"
}
```

## Complete Implementation Guide

### 1. Update AadhaarInputScreen.tsx

```typescript
// Add helper function to check RD availability
const checkAndStartAuth = useCallback(async (): Promise<void> => {
  const rawAadhaar = getRawAadhaarNumber(aadhaarInput);
  if (rawAadhaar?.length !== AADHAAR_LENGTH) {
    setAadhaarNumberErr(t('aadhaar.aadhaarLengthError'));
    return;
  }

  setAadhaarNumberErr('');
  
  if (Platform.OS === 'android') {
    const { FaceAuth } = NativeModules;
    
    // Check if native module exists and RD Service is available
    if (FaceAuth) {
      // Try Face RD first
      dispatch(setIsAuthenticatingFace(true));
      
      if (__DEV__) {
        // Dev mode: Skip to OTP for testing
        navigateToOTPScreen(rawAadhaar);
      } else {
        // Production: Start Face RD
        startFaceAuth(rawAadhaar);
        // Success/failure handled by event listeners
      }
    } else {
      // Native module not available, use OTP
      navigateToOTPScreen(rawAadhaar);
    }
  } else {
    // iOS: Use OTP directly
    navigateToOTPScreen(rawAadhaar);
  }
}, [aadhaarInput, dispatch, t, navigation]);

const navigateToOTPScreen = useCallback((rawAadhaar: string): void => {
  navigation.navigate('OtpScreen', {
    emailID: store.getState().userState?.userData?.email || '',
    isAadhaarFallback: true,
    aadhaarNumber: rawAadhaar,
  });
}, [navigation]);
```

### 2. Create OTP API Service

```typescript
// src/services/aadhaar/otp-service.ts
import axios from 'axios';
import Config from 'react-native-config';

const API_BASE_URL = Config.API_BASE_URL || 'https://your-api.com';

export interface RequestOTPParams {
  aadhaarNumber: string;
  emailID: string;
}

export interface VerifyOTPParams {
  aadhaarNumber: string;
  otp: string;
  emailID: string;
}

/**
 * Request OTP for Aadhaar verification
 */
export const requestAadhaarOTP = async (params: RequestOTPParams): Promise<boolean> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/aadhaar/request-otp`,
      {
        aadhaarNumber: params.aadhaarNumber,
        emailID: params.emailID,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data?.success === true;
  } catch (error: any) {
    console.error('Failed to request Aadhaar OTP:', error);
    throw error;
  }
};

/**
 * Verify OTP for Aadhaar verification
 */
export const verifyAadhaarOTP = async (params: VerifyOTPParams): Promise<boolean> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/aadhaar/verify-otp`,
      {
        aadhaarNumber: params.aadhaarNumber,
        otp: params.otp,
        emailID: params.emailID,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data?.verified === true && response.data?.success === true;
  } catch (error: any) {
    console.error('Failed to verify Aadhaar OTP:', error);
    throw error;
  }
};
```

### 3. Update OtpScreen.tsx

```typescript
// Add imports
import { requestAadhaarOTP, verifyAadhaarOTP } from '../../services/aadhaar/otp-service';

// In component, add useEffect to request OTP when screen loads
useEffect(() => {
  if (isAadhaarFallback && aadhaarNumber) {
    // Request OTP when screen loads
    requestAadhaarOTP({
      aadhaarNumber: aadhaarNumber,
      emailID: emailID,
    }).catch(error => {
      console.error('Failed to request OTP:', error);
      setOtpError(t('otp.requestFailed', 'Failed to request OTP. Please try again.'));
    });
  }
}, [isAadhaarFallback, aadhaarNumber, emailID, t]);

// Update onConfirmButtonPress (as shown in Step 3 above)
```

## Backend Implementation (Example)

### Node.js/Express Example

```javascript
// routes/aadhaar.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Request OTP
router.post('/request-otp', async (req, res) => {
  const { aadhaarNumber, emailID } = req.body;
  
  try {
    // Option 1: Call UIDAI OTP API directly (requires UIDAI credentials)
    // Option 2: Call third-party service (eMudhra, Signzy, etc.)
    
    // Example with third-party service
    const response = await axios.post('https://api.provider.com/aadhaar/otp', {
      aadhaarNumber: aadhaarNumber,
      emailID: emailID,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.AADHAAR_API_KEY}`,
      },
    });
    
    res.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    console.error('OTP request failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { aadhaarNumber, otp, emailID } = req.body;
  
  try {
    // Verify OTP with UIDAI or third-party service
    const response = await axios.post('https://api.provider.com/aadhaar/verify', {
      aadhaarNumber: aadhaarNumber,
      otp: otp,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.AADHAAR_API_KEY}`,
      },
    });
    
    if (response.data.verified) {
      res.json({
        success: true,
        verified: true,
        message: 'Aadhaar verified successfully',
      });
    } else {
      res.json({
        success: false,
        verified: false,
        message: 'Invalid OTP',
      });
    }
  } catch (error) {
    console.error('OTP verification failed:', error);
    res.status(500).json({
      success: false,
      verified: false,
      message: 'OTP verification failed',
    });
  }
});

module.exports = router;
```

## Flow Diagram

```
┌─────────────────────────────────────┐
│   User Enters Aadhaar Number       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Platform Check                    │
│   - iOS? → OTP                     │
│   - Android? → Check RD Service    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│ RD Available │  │ RD Not Avail │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Start Face RD│  │ Request OTP   │
└──────┬───────┘  └──────┬───────┘
       │                 │
   ┌───┴───┐             │
   │       │             │
   ▼       ▼             ▼
┌─────┐ ┌─────┐     ┌──────────┐
│Success│Failure│     │Verify OTP│
└───┬──┘ └───┬─┘     └────┬─────┘
    │        │            │
    │        └──────┬─────┘
    │               │
    ▼               ▼
┌─────────────────────────┐
│ Store Aadhaar & Navigate │
│    to CheckInScreen      │
└─────────────────────────┘
```

## Key Points

1. **Always check RD Service availability** before attempting Face RD
2. **Automatic fallback** to OTP if RD Service is not available
3. **OTP is primary method** on iOS (RD Service not available)
4. **Backend API required** for OTP (can't be done client-side only)
5. **Store Aadhaar securely** after successful verification (either method)

## Testing Checklist

- [ ] Test with RD Service installed (Android)
- [ ] Test with RD Service not installed (Android)
- [ ] Test Face RD success flow
- [ ] Test Face RD failure → OTP fallback
- [ ] Test direct OTP flow (iOS/Android without RD)
- [ ] Test OTP request API
- [ ] Test OTP verification API
- [ ] Test error handling for all scenarios

