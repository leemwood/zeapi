package cn.lemwood.zeapi.data.local

import android.content.Context
import cn.lemwood.zeapi.data.SharedPreferencesManager
import org.json.JSONObject

/**
 * 工具服务基类
 * 提供统一的请求头处理和通用功能
 */
abstract class BaseToolService(protected val context: Context) {
    
    protected val sharedPreferencesManager = SharedPreferencesManager(context)
    
    /**
     * 获取当前配置的请求头
     * @return 包含所有配置请求头的Map
     */
    protected fun getCurrentHeaders(): Map<String, String> {
        val headers = mutableMapOf<String, String>()
        
        // 添加 User-Agent
        val userAgent = sharedPreferencesManager.getUserAgent()
        if (userAgent.isNotEmpty()) {
            headers["User-Agent"] = userAgent
        }
        
        // 添加 Authorization
        val authorization = sharedPreferencesManager.getAuthorization()
        if (authorization.isNotEmpty()) {
            headers["Authorization"] = authorization
        }
        
        // 添加自定义请求头
        val customHeaders = sharedPreferencesManager.getCustomHeaders()
        if (customHeaders.isNotEmpty()) {
            try {
                val jsonObject = JSONObject(customHeaders)
                val keys = jsonObject.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val value = jsonObject.getString(key)
                    headers[key] = value
                }
            } catch (e: Exception) {
                // 忽略解析错误，继续使用其他请求头
            }
        }
        
        return headers
    }
    
    /**
     * 记录工具执行日志
     * @param toolName 工具名称
     * @param action 执行的操作
     * @param message 日志消息
     */
    protected fun logToolExecution(toolName: String, action: String, message: String) {
        println("[$toolName] $action: $message")
    }
    
    /**
     * 处理工具执行异常
     * @param toolName 工具名称
     * @param exception 异常信息
     * @return 格式化的错误消息
     */
    protected fun handleToolException(toolName: String, exception: Exception): String {
        val errorMessage = "工具执行失败: ${exception.message ?: "未知错误"}"
        logToolExecution(toolName, "ERROR", errorMessage)
        return errorMessage
    }
    
    /**
     * 验证必需参数
     * @param params 参数Map
     * @param requiredKeys 必需的参数键列表
     * @return 验证结果，true表示所有必需参数都存在
     */
    protected fun validateRequiredParams(params: Map<String, String>, requiredKeys: List<String>): Boolean {
        return requiredKeys.all { key ->
            params.containsKey(key) && !params[key].isNullOrBlank()
        }
    }
    
    /**
     * 获取参数值，如果不存在则返回默认值
     * @param params 参数Map
     * @param key 参数键
     * @param defaultValue 默认值
     * @return 参数值或默认值
     */
    protected fun getParamOrDefault(params: Map<String, String>, key: String, defaultValue: String): String {
        return params[key]?.takeIf { it.isNotBlank() } ?: defaultValue
    }
}