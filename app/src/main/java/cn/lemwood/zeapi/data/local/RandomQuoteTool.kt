package cn.lemwood.zeapi.data.local

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * 随机一言工具类
 * 负责处理随机名言警句获取功能
 */
class RandomQuoteTool(context: Context) : BaseToolService(context) {
    
    private val httpClient = OkHttpClient()
    private val toolName = "随机一言"
    
    /**
     * 调用随机一言API
     */
    suspend fun getRandomQuote(): String {
        return withContext(Dispatchers.IO) {
            try {
                logToolExecution(toolName, "REQUEST", "请求随机一言")
                
                val requestBuilder = Request.Builder()
                    .url("https://zeapi.ink/v1/api/onesay")
                
                // 添加配置的请求头
                val headers = getCurrentHeaders()
                headers.forEach { (key, value) ->
                    requestBuilder.addHeader(key, value)
                }
                
                val request = requestBuilder.build()
                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""
                
                if (response.isSuccessful) {
                    responseBody.ifEmpty { "获取一言失败" }
                } else {
                    "请求失败：${response.code}"
                }
            } catch (e: Exception) {
                "网络请求失败：${e.message}"
            }
        }
    }
    
    /**
     * 使用参数Map执行工具
     * @param params 参数Map（随机一言不需要参数，但保持接口一致性）
     */
    suspend fun execute(params: Map<String, String>): String {
        return try {
            logToolExecution(toolName, "EXECUTE", "开始执行随机一言")
            
            val result = getRandomQuote()
            logToolExecution(toolName, "SUCCESS", "执行成功")
            result
        } catch (e: Exception) {
            handleToolException(toolName, e)
        }
    }
}