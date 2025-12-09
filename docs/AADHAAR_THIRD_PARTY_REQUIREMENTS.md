# Aadhaar Face RD Integration - Third-Party Requirements

## Overview

For **actual Aadhaar Face RD integration**, you need several third-party components and official UIDAI services. This document outlines all requirements.

## Required Third-Party Components

### 1. **UIDAI RD Service (Official - Required)**

**What it is:**
- Official UIDAI (Unique Identification Authority of India) Recognition Device Service
- A system app that must be installed on Android devices
- Handles the actual Aadhaar biometric authentication

**Requirements:**
- **Device Requirement**: Must be installed on the user's Android device
- **Installation**: Users need to install from Play Store or as system app
- **Package Name**: `in.gov.uidai.rdservice`
- **Availability**: Only on Android (not available on iOS)

**How to Check:**
```java
// Check if UIDAI RD Service is installed
Intent intent = new Intent();
intent.setPackage("in.gov.uidai.rdservice");
List<ResolveInfo> resolveInfoList = getPackageManager().queryIntentActivities(intent, 0);
boolean isInstalled = resolveInfoList.size() > 0;
```

**Download:**
- Play Store: Search "UIDAI RD Service"
- Direct APK: Available from UIDAI official website

---

### 2. **UIDAI RD SDK / Native Module (Required)**

**What it is:**
- Native Android SDK provided by UIDAI or authorized vendors
- Allows your app to communicate with UIDAI RD Service
- Provides APIs for Face RD authentication

**Options:**

#### Option A: Direct UIDAI RD SDK (If Available)
- Official SDK from UIDAI
- Contact UIDAI for SDK access and licensing

#### Option B: Third-Party Aadhaar SDK Providers

**Popular Providers:**

1. **eMudhra Aadhaar SDK**
   - Website: https://www.emudhra.com/
   - Provides Aadhaar authentication SDK
   - Requires business license/partnership

2. **Signzy Aadhaar SDK**
   - Website: https://signzy.com/
   - Aadhaar eKYC and authentication services
   - API-based integration

3. **Digio Aadhaar SDK**
   - Website: https://www.digio.in/
   - Aadhaar verification services
   - SDK and API options

4. **IDfy Aadhaar SDK**
   - Website: https://www.idfy.com/
   - Aadhaar authentication and eKYC
   - Multiple integration options

**What You Need:**
- Business registration/license
- Partnership agreement with provider
- API keys/credentials
- SDK files (.aar or .jar)
- Documentation and integration support

---

### 3. **Native Module Implementation (You Need to Build)**

**Current Status:**
- ❌ **NOT IMPLEMENTED** - The `FaceAuth` native module doesn't exist in your codebase
- You need to create it

**What You Need to Build:**

#### Android Native Module (`FaceAuthModule.kt` or `.java`)

```kotlin
package com.colabclient

import android.content.Intent
import android.app.Activity
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventEmitterModule

class FaceAuthModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "FaceAuth"
    }
    
    @ReactMethod
    fun startFaceAuth(aadhaarNo: String, licenseKey: String) {
        val activity = currentActivity
        if (activity == null) {
            sendError("Activity not available")
            return
        }
        
        // Check if UIDAI RD Service is installed
        if (!isRDServiceInstalled()) {
            sendError("UIDAI RD Service not installed")
            return
        }
        
        try {
            // Create intent to launch UIDAI RD Service
            val intent = Intent()
            intent.setPackage("in.gov.uidai.rdservice")
            intent.action = "in.gov.uidai.rdservice.fingerprint"
            
            // Add required extras
            intent.putExtra("aadhaarNumber", aadhaarNo)
            intent.putExtra("licenseKey", licenseKey)
            intent.putExtra("pidOptions", "{\"type\":\"X\",\"version\":\"2.0\"}")
            
            // Start activity for result
            activity.startActivityForResult(intent, REQUEST_CODE_FACE_AUTH)
            
        } catch (e: Exception) {
            sendError("Failed to start Face RD: ${e.message}")
        }
    }
    
    private fun isRDServiceInstalled(): Boolean {
        val intent = Intent()
        intent.setPackage("in.gov.uidai.rdservice")
        val resolveInfo = reactApplicationContext.packageManager.queryIntentActivities(intent, 0)
        return resolveInfo.isNotEmpty()
    }
    
    private fun sendSuccess(data: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventEmitterModule.RCTDeviceEventEmitter::class.java)
            .emit("FaceAuthSuccess", data)
    }
    
    private fun sendError(message: String) {
        val error = Arguments.createMap()
        error.putString("message", message)
        reactApplicationContext
            .getJSModule(DeviceEventEmitterModule.RCTDeviceEventEmitter::class.java)
            .emit("FaceAuthFailure", error)
    }
}
```

**Register Module:**

```kotlin
// FaceAuthPackage.kt
package com.colabclient

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext

class FaceAuthPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(FaceAuthModule(reactContext))
    }
    
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

**Register in MainApplication.kt:**

```kotlin
override fun getPackages(): List<ReactPackage> {
    return listOf(
        MainReactPackage(),
        FaceAuthPackage() // Add this
    )
}
```

---

### 4. **License Key / API Credentials (Required)**

**What it is:**
- License key or API credentials from UIDAI or authorized vendor
- Used to authenticate your app with UIDAI RD Service
- Currently hardcoded in your code (needs to be secured)

**Current Code:**
```typescript
FaceAuth.startFaceAuth(
  aadhaarNo,
  'MDczRjUyNDJDQUFGRjBBOUMzMUZGQUVEOTA4QkYzOEU2RENBNEQ4OTIwMzRGQzY1NDA0QzIyMjk3RkJENkNDMghtG==', // This needs to be your actual license key
);
```

**How to Get:**
1. Register with UIDAI or authorized vendor
2. Complete business verification
3. Obtain license key/API credentials
4. Store securely (use environment variables, not hardcoded)

---

## Integration Steps

### Step 1: Choose Your Provider
- Decide: Direct UIDAI SDK or Third-Party Provider
- Consider: Cost, support, documentation, compliance

### Step 2: Register and Get Credentials
- Complete business registration
- Obtain license key/API credentials
- Get SDK files and documentation

### Step 3: Implement Native Module
- Create Android native module (see code above)
- Register in React Native
- Handle success/failure events

### Step 4: Update React Native Code
- Update `startFaceAuth()` to use actual license key
- Store license key securely (environment variables)
- Test integration

### Step 5: Testing
- Install UIDAI RD Service on test device
- Test with valid Aadhaar numbers
- Handle all error cases

---

## Cost Considerations

### UIDAI Direct Integration
- May require official partnership
- Compliance and certification costs
- Ongoing maintenance

### Third-Party Providers
- **Per Transaction**: Usually ₹2-10 per authentication
- **Monthly Plans**: Subscription-based pricing
- **Setup Fees**: One-time integration fees
- **Support**: May include support packages

**Example Pricing (Approximate):**
- eMudhra: ₹5-8 per transaction
- Signzy: ₹3-6 per transaction
- Digio: ₹4-7 per transaction

---

## Compliance and Legal Requirements

### 1. **Aadhaar Act Compliance**
- Must comply with Aadhaar Act 2016
- Proper consent from users
- Data privacy and security requirements

### 2. **Business Registration**
- Valid business entity registration
- GST registration (if applicable)
- Compliance with Indian laws

### 3. **Data Security**
- Encrypt Aadhaar data
- Secure storage (Keychain)
- No logging of full Aadhaar numbers
- Compliance with data protection laws

### 4. **User Consent**
- Clear privacy policy
- Explicit consent for Aadhaar usage
- Purpose limitation

---

## Current Implementation Status

### ✅ What's Done:
- React Native UI for Aadhaar input
- Event listeners for success/failure
- OTP fallback flow
- Aadhaar storage in Keychain

### ❌ What's Missing:
- **Native Android module** (`FaceAuthModule`)
- **Actual UIDAI RD Service integration**
- **Valid license key** (currently using placeholder)
- **Error handling** for all UIDAI error codes
- **Testing** with real UIDAI RD Service

---

## Recommended Approach

### For Production:

1. **Choose a Third-Party Provider** (Easier)
   - Sign up with eMudhra, Signzy, or similar
   - Get SDK and credentials
   - Implement their SDK in native module
   - Usually faster to integrate

2. **Or Direct UIDAI Integration** (More Complex)
   - Contact UIDAI for official SDK
   - Complete compliance requirements
   - Build native module from scratch
   - More control but more work

### For Development/Testing:

1. **Mock Implementation** (Current)
   - Use dev mode to skip Face RD
   - Test UI flows
   - Implement OTP fallback

2. **Test with UIDAI RD Service**
   - Install UIDAI RD Service APK
   - Use test Aadhaar numbers
   - Test with actual service

---

## Next Steps

1. **Decide on Provider**: Choose UIDAI direct or third-party
2. **Get Credentials**: Register and obtain license key
3. **Build Native Module**: Implement Android native module
4. **Update Code**: Replace placeholder with actual integration
5. **Test**: Test with real UIDAI RD Service
6. **Deploy**: Secure license key, handle errors, deploy

---

## Resources

- **UIDAI Official**: https://uidai.gov.in/
- **UIDAI RD Service**: Search Play Store for "UIDAI RD Service"
- **eMudhra**: https://www.emudhra.com/
- **Signzy**: https://signzy.com/
- **Digio**: https://www.digio.in/

---

## Important Notes

⚠️ **Security**: Never commit license keys to version control
⚠️ **Compliance**: Ensure full compliance with Aadhaar Act
⚠️ **Testing**: Always test with real UIDAI RD Service before production
⚠️ **Fallback**: OTP fallback is essential for users without Face RD support

