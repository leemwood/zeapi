package cn.lemwood.zeapi.data.local

import android.content.Context
import android.content.SharedPreferences
import cn.lemwood.zeapi.utils.Constants

class SharedPreferencesManager(context: Context) {
    private val sharedPreferences: SharedPreferences = 
        context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
    
    fun saveRequestHeader(header: String) {
        sharedPreferences.edit()
            .putString(Constants.KEY_REQUEST_HEADER, header)
            .apply()
    }
    
    fun getRequestHeader(): String {
        return sharedPreferences.getString(Constants.KEY_REQUEST_HEADER, "") ?: ""
    }
    
    fun clearAll() {
        sharedPreferences.edit().clear().apply()
    }
}
