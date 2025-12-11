package com.colabclient

import android.content.Context
import android.content.Intent
import android.location.LocationManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LocationEnablerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "LocationEnabler"
    }

    /**
     * Check if location services are enabled on the device
     * Returns true if location is enabled, false otherwise
     */
    @ReactMethod
    fun isLocationEnabled(promise: Promise) {
        val context: Context? = reactApplicationContext
        try {
            context?.let {
                val locationManager = it.getSystemService(Context.LOCATION_SERVICE) as LocationManager
                val isEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                        locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                promise.resolve(isEnabled)
            } ?: promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("LOCATION_ERROR", "Error checking location status: ${e.message}", e)
        }
    }

    /**
     * Open location settings to enable location services
     * Returns true if location was enabled, false otherwise
     */
    @ReactMethod
    fun enableLocation(promise: Promise) {
        val context: Context? = reactApplicationContext
        try {
            context?.let {
                val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                it.startActivity(intent)
                // Note: We can't know if user actually enabled it, so we return true
                // The calling code should check isLocationEnabled() again after this
                promise.resolve(true)
            } ?: promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("LOCATION_ERROR", "Error opening location settings: ${e.message}", e)
        }
    }
}


