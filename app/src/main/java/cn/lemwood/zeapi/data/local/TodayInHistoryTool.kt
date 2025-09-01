package cn.lemwood.zeapi.data.local

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/**
 * 历史上的今天工具类
 * 负责处理历史事件查询功能
 */
class TodayInHistoryTool(context: Context) : BaseToolService(context) {
    
    private val httpClient = OkHttpClient()
    private val toolName = "历史上的今天"
    
    /**
     * 调用历史上的今天API
     * @param month 月份（可选）
     * @param day 日期（可选）
     */
    suspend fun getTodayInHistory(month: Int? = null, day: Int? = null): String {
        return getTodayInHistoryInternal(month, day)
    }
    
    /**
     * 调用历史上的今天API
     * @param dateParam 日期参数，格式：MM-DD
     */
    suspend fun getTodayInHistory(dateParam: String): String {
        return if (dateParam.contains("-")) {
            val parts = dateParam.split("-")
            if (parts.size == 2) {
                val month = parts[0].toIntOrNull()
                val day = parts[1].toIntOrNull()
                getTodayInHistoryInternal(month, day)
            } else {
                getTodayInHistoryInternal()
            }
        } else {
            getTodayInHistoryInternal()
        }
    }
    
    /**
     * 调用历史上的今天API（无参数版本）
     */
    suspend fun getTodayInHistory(): String {
        return getTodayInHistoryInternal()
    }
    
    /**
     * 使用参数Map执行工具
     * @param params 参数Map，支持month和day参数
     */
    suspend fun execute(params: Map<String, String>): String {
        return try {
            logToolExecution(toolName, "EXECUTE", "开始执行，参数: $params")
            
            val month = params["month"]?.toIntOrNull()
            val day = params["day"]?.toIntOrNull()
            
            val result = getTodayInHistoryInternal(month, day)
            logToolExecution(toolName, "SUCCESS", "执行成功")
            result
        } catch (e: Exception) {
            handleToolException(toolName, e)
        }
    }
    
    /**
     * 内部实现：调用历史上的今天API
     * @param month 月份（可选）
     * @param day 日期（可选）
     */
    private suspend fun getTodayInHistoryInternal(month: Int? = null, day: Int? = null): String {
        return withContext(Dispatchers.IO) {
            try {
                val url = if (month != null && day != null) {
                    "https://zeapi.ink/v1/api/today?month=$month&day=$day"
                } else {
                    "https://zeapi.ink/v1/api/today"
                }
                
                logToolExecution(toolName, "REQUEST", "请求URL: $url")
                
                val requestBuilder = Request.Builder().url(url)
                
                // 添加配置的请求头
                val headers = getCurrentHeaders()
                headers.forEach { (key, value) ->
                    requestBuilder.addHeader(key, value)
                }
                
                val request = requestBuilder.build()
                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""
                
                if (response.isSuccessful) {
                    // 解析JSON响应
                    try {
                        val jsonObject = JSONObject(responseBody)
                        val dataArray = jsonObject.getJSONArray("data")
                        
                        val events = mutableListOf<String>()
                        for (i in 0 until dataArray.length()) {
                            val event = dataArray.getJSONObject(i)
                            val year = event.getString("year")
                            val title = event.getString("title")
                            events.add("$year 年：$title")
                        }
                        
                        if (events.isNotEmpty()) {
                            "历史上的今天：\n\n" + events.joinToString("\n\n")
                        } else {
                            "暂无历史事件数据"
                        }
                    } catch (e: Exception) {
                        // 如果JSON解析失败，直接返回原始响应
                        responseBody.ifEmpty { "获取历史事件失败" }
                    }
                } else {
                    "请求失败：${response.code}"
                }
            } catch (e: Exception) {
                "网络请求失败：${e.message}"
            }
        }
    }
}