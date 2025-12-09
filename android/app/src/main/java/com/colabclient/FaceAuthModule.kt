package com.colabclient

import android.app.Activity
import android.content.Intent
import android.content.pm.ResolveInfo
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter

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
        
        // Validate license key
        if (licenseKey.isBlank()) {
            sendError("License key is required")
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
    
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE_FACE_AUTH) {
            return
        }
        
        when (resultCode) {
            Activity.RESULT_OK -> {
                // Success - parse response
                val response = data?.getStringExtra("response") ?: ""
                val successData = Arguments.createMap()
                successData.putString("response", response)
                successData.putString("aadhaarNumber", data?.getStringExtra("aadhaarNumber") ?: "")
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
            .getJSModule(RCTDeviceEventEmitter::class.java)
            .emit("FaceAuthSuccess", data)
    }
    
    private fun sendError(message: String) {
        val error = Arguments.createMap()
        error.putString("message", message)
        error.putString("code", "FACE_AUTH_ERROR")
        reactApplicationContext
            .getJSModule(RCTDeviceEventEmitter::class.java)
            .emit("FaceAuthFailure", error)
    }
    
    override fun onNewIntent(intent: Intent) {
        // Not needed for this module
    }
}
