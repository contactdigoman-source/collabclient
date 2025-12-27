package com.colabclient

import android.content.Context
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SecurityUtilsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SecurityUtils"
    }

    /**
     * Check if USB debugging is enabled on the device
     * Returns true if USB debugging is enabled, false otherwise
     */
    @ReactMethod
    fun isUsbDebuggingEnabled(callback: Callback) {
        val context: Context? = reactApplicationContext
        try {
            context?.let {
                val adbEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
                    Settings.Global.getInt(
                        it.contentResolver,
                        Settings.Global.ADB_ENABLED,
                        0
                    ) == 1
                } else {
                    Settings.Secure.getInt(
                        it.contentResolver,
                        Settings.Secure.ADB_ENABLED,
                        0
                    ) == 1
                }
                callback.invoke(null, adbEnabled)
            } ?: callback.invoke(null, false)
        } catch (e: Exception) {
            callback.invoke(e.message, false)
        }
    }

    /**
     * Check if Developer Options is enabled
     */
    @ReactMethod
    fun isDeveloperModeEnabled(callback: Callback) {
        val context: Context? = reactApplicationContext
        try {
            context?.let {
                val isDeveloperModeEnabled = Settings.Global.getInt(
                    it.contentResolver,
                    Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                    0
                ) == 1
                callback.invoke(null, isDeveloperModeEnabled)
            } ?: callback.invoke(null, false)
        } catch (e: Exception) {
            callback.invoke(e.message, false)
        }
    }

    /**
     * Check if automatic time setting is enabled on the device
     * Returns true if automatic time is enabled, false otherwise
     */
    @ReactMethod
    fun isAutomaticTimeEnabled(callback: Callback) {
        val context: Context? = reactApplicationContext
        try {
            context?.let {
                val isAutoTimeEnabled = Settings.Global.getInt(
                    it.contentResolver,
                    Settings.Global.AUTO_TIME,
                    0
                ) == 1
                callback.invoke(null, isAutoTimeEnabled)
            } ?: callback.invoke(null, false)
        } catch (e: Exception) {
            callback.invoke(e.message, false)
        }
    }
}

