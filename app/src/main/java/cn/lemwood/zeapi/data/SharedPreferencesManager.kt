package cn.lemwood.zeapi.data

import android.content.Context
import android.content.SharedPreferences

class SharedPreferencesManager(context: Context) {
    
    private val sharedPreferences: SharedPreferences = 
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    
    companion object {
        private const val PREFS_NAME = "zeapi_preferences"
        
        // 请求头相关键
        private const val KEY_USER_AGENT = "user_agent"
        private const val KEY_AUTHORIZATION = "authorization"
        private const val KEY_CUSTOM_HEADERS = "custom_headers"
        
        // 应用设置相关键
        private const val KEY_FIRST_LAUNCH = "first_launch"
        private const val KEY_LAST_UPDATE_CHECK = "last_update_check"
        
        // 默认值
        private const val DEFAULT_USER_AGENT = "zeapi-android/1.0.0"
    }
    
    // ========== 请求头设置 ==========
    
    /**
     * 保存 User-Agent
     */
    fun saveUserAgent(userAgent: String) {
        sharedPreferences.edit()
            .putString(KEY_USER_AGENT, userAgent)
            .apply()
    }
    
    /**
     * 获取 User-Agent
     */
    fun getUserAgent(): String {
        return sharedPreferences.getString(KEY_USER_AGENT, DEFAULT_USER_AGENT) ?: DEFAULT_USER_AGENT
    }
    
    /**
     * 保存 Authorization
     */
    fun saveAuthorization(authorization: String) {
        sharedPreferences.edit()
            .putString(KEY_AUTHORIZATION, authorization)
            .apply()
    }
    
    /**
     * 获取 Authorization
     */
    fun getAuthorization(): String {
        return sharedPreferences.getString(KEY_AUTHORIZATION, "") ?: ""
    }
    
    /**
     * 保存自定义请求头 (JSON格式)
     */
    fun saveCustomHeaders(customHeaders: String) {
        sharedPreferences.edit()
            .putString(KEY_CUSTOM_HEADERS, customHeaders)
            .apply()
    }
    
    /**
     * 获取自定义请求头 (JSON格式)
     */
    fun getCustomHeaders(): String {
        return sharedPreferences.getString(KEY_CUSTOM_HEADERS, "") ?: ""
    }
    
    /**
     * 清除所有请求头设置
     */
    fun clearHeaderSettings() {
        sharedPreferences.edit()
            .remove(KEY_USER_AGENT)
            .remove(KEY_AUTHORIZATION)
            .remove(KEY_CUSTOM_HEADERS)
            .apply()
    }
    
    // ========== 应用设置 ==========
    
    /**
     * 设置是否为首次启动
     */
    fun setFirstLaunch(isFirstLaunch: Boolean) {
        sharedPreferences.edit()
            .putBoolean(KEY_FIRST_LAUNCH, isFirstLaunch)
            .apply()
    }
    
    /**
     * 检查是否为首次启动
     */
    fun isFirstLaunch(): Boolean {
        return sharedPreferences.getBoolean(KEY_FIRST_LAUNCH, true)
    }
    
    /**
     * 保存最后更新检查时间
     */
    fun saveLastUpdateCheck(timestamp: Long) {
        sharedPreferences.edit()
            .putLong(KEY_LAST_UPDATE_CHECK, timestamp)
            .apply()
    }
    
    /**
     * 获取最后更新检查时间
     */
    fun getLastUpdateCheck(): Long {
        return sharedPreferences.getLong(KEY_LAST_UPDATE_CHECK, 0L)
    }
    
    // ========== 通用方法 ==========
    
    /**
     * 清除所有设置
     */
    fun clearAllSettings() {
        sharedPreferences.edit().clear().apply()
    }
    
    /**
     * 检查某个键是否存在
     */
    fun contains(key: String): Boolean {
        return sharedPreferences.contains(key)
    }
    
    /**
     * 获取所有设置的键值对（用于调试）
     */
    fun getAllSettings(): Map<String, *> {
        return sharedPreferences.all
    }
    
    /**
     * 获取当前所有请求头设置的摘要
     */
    fun getHeadersSummary(): String {
        val userAgent = getUserAgent()
        val authorization = getAuthorization()
        val customHeaders = getCustomHeaders()
        
        return buildString {
            appendLine("User-Agent: ${if (userAgent.isNotEmpty()) userAgent else "未设置"}")
            appendLine("Authorization: ${if (authorization.isNotEmpty()) "已设置" else "未设置"}")
            appendLine("自定义请求头: ${if (customHeaders.isNotEmpty()) "已设置" else "未设置"}")
        }
    }
}