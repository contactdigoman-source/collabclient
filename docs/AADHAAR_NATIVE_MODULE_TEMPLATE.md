# Aadhaar Face RD Native Module - Implementation Template

This is a template for implementing the Android native module for Aadhaar Face RD integration.

## File Structure

```
android/app/src/main/java/com/colabclient/
├── FaceAuthModule.kt          (New - Native module)
├── FaceAuthPackage.kt         (New - Package registration)
└── MainApplication.kt         (Update - Register package)
```

## Step 1: Create FaceAuthModule.kt

```kotlin
package com.colabclient

import android.app.Activity
import android.content.Intent
import android.content.pm.ResolveInfo
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventEmitter

class FaceAuthModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    companion object {
        private const val REQUEST_CODE_FACE_AUTH = 1001
        private const val UIDAI_RD_PACKAGE = "in.gov.uidai.rdservice"
    }
    
    init {
        reactContext.addActivityEventListener(this)
    }
    
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
        
        // Validate Aadhaar number
        if (aadhaarNo.length != 12 || !aadhaarNo.matches(Regex("^[0-9]+$"))) {
            sendError("Invalid Aadhaar number")
            return
        }
        
        // Check if UIDAI RD Service is installed
        if (!isRDServiceInstalled()) {
            sendError("UIDAI RD Service is NOT installed or blocked.")
            return
        }
        
        try {
            // Create intent to launch UIDAI RD Service
            val intent = Intent()
            intent.setPackage(UIDAI_RD_PACKAGE)
            intent.action = "in.gov.uidai.rdservice.fingerprint"
            
            // Add required extras
            intent.putExtra("aadhaarNumber", aadhaarNo)
            intent.putExtra("licenseKey", licenseKey)
            
            // PID Options - for Face authentication
            val pidOptions = """
                {
                    "type": "X",
                    "version": "2.0",
                    "bioType": "F",
                    "bioSubType": "FMR"
                }
            """.trimIndent()
            intent.putExtra("pidOptions", pidOptions)
            
            // Start activity for result
            activity.startActivityForResult(intent, REQUEST_CODE_FACE_AUTH)
            
        } catch (e: Exception) {
            sendError("Failed to start Face RD: ${e.message}")
        }
    }
    
    private fun isRDServiceInstalled(): Boolean {
        return try {
            val intent = Intent()
            intent.setPackage(UIDAI_RD_PACKAGE)
            val resolveInfo: List<ResolveInfo> = reactApplicationContext
                .packageManager
                .queryIntentActivities(intent, 0)
            resolveInfo.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }
    
    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE_FACE_AUTH) {
            return
        }
        
        when (resultCode) {
            Activity.RESULT_OK -> {
                // Success - parse response
                val response = data?.getStringExtra("response") ?: ""
                val successData = Arguments.createMap()
                successData.putString("response", response)
                sendSuccess(successData)
            }
            Activity.RESULT_CANCELED -> {
                // User cancelled
                sendError("User abort")
            }
            else -> {
                // Error - get error code
                val errorCode = data?.getStringExtra("errCode") ?: "UNKNOWN_ERROR"
                val errorMessage = getErrorMessage(errorCode)
                sendError(errorMessage)
            }
        }
    }
    
    private fun getErrorMessage(errorCode: String): String {
        return when (errorCode) {
            "Y" -> "Aadhaar number and face not matching"
            "N" -> "Could not fetch Aadhaar Reference Number from ADV"
            "U" -> "Unknown error occurred"
            "E" -> "Network issue occurred, Please try after some time"
            else -> "Could Not Authenticate Aadhaar"
        }
    }
    
    private fun sendSuccess(data: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventEmitter.RCTDeviceEventEmitter::class.java)
            .emit("FaceAuthSuccess", data)
    }
    
    private fun sendError(message: String) {
        val error = Arguments.createMap()
        error.putString("message", message)
        error.putString("code", "FACE_AUTH_ERROR")
        reactApplicationContext
            .getJSModule(DeviceEventEmitter.RCTDeviceEventEmitter::class.java)
            .emit("FaceAuthFailure", error)
    }
    
    override fun onNewIntent(intent: Intent?) {
        // Not needed for this module
    }
}
```

## Step 2: Create FaceAuthPackage.kt

```kotlin
package com.colabclient

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FaceAuthPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(FaceAuthModule(reactContext))
    }
    
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

## Step 3: Update MainApplication.kt

Add the package to your existing `getPackages()` method:

```kotlin
override fun getPackages(): List<ReactPackage> {
    return listOf(
        MainReactPackage(),
        LocationEnablerPackage(), // Existing
        SecurityUtilsPackage(),    // Existing
        FaceAuthPackage()          // Add this
    )
}
```

## Step 4: Update AndroidManifest.xml

Add required permissions (if not already present):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
```

## Step 5: Update React Native Code

Update `aadhaar-facerd-service.ts` to use environment variable for license key:

```typescript
import Config from 'react-native-config';

export function startFaceAuth(aadhaarNo: string): void {
  // Get license key from environment
  const licenseKey = Config.AADHAAR_LICENSE_KEY || '';
  
  if (!licenseKey) {
    console.error('Aadhaar license key not configured');
    DeviceEventEmitter.emit('FaceAuthFailure', {
      message: 'License key not configured',
      code: 'LICENSE_MISSING',
    });
    return;
  }
  
  if (aadhaarNo && FaceAuth) {
    store.dispatch(setIsAuthenticatingFace(true));
    FaceAuth.startFaceAuth(aadhaarNo, licenseKey);
  }
}
```

## Step 6: Add to .env

```bash
AADHAAR_LICENSE_KEY=your_actual_license_key_here
```

## Testing

1. Install UIDAI RD Service APK on test device
2. Build and run app
3. Enter test Aadhaar number
4. Test Face RD authentication
5. Verify success/failure events

## Notes

- Replace `your_actual_license_key_here` with real license key from UIDAI or vendor
- Test with real UIDAI RD Service before production
- Handle all error cases properly
- Ensure compliance with Aadhaar Act

