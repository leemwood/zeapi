package cn.lemwood.zeapi.service

import cn.lemwood.zeapi.data.model.Tool
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

/**
 * 本地工具服务类
 * 硬编码实现工具功能，直接调用zeapi.ink的API
 */
class LocalToolService {
    
    private val httpClient = OkHttpClient()
    
    companion object {
        // 硬编码的工具列表
        private val TOOLS = listOf(
            Tool(
                id = "today_in_history",
                name = "历史上的今天",
                description = "查看历史上的今天发生了什么事件",
                category = "历史",
                url = "https://zeapi.ink/v1/today.php",
                icon = "📅",
                isRecommended = true
            ),
            Tool(
                id = "random_quote",
                name = "随机一言",
                description = "获取一句随机的名言警句",
                category = "文学",
                url = "https://zeapi.ink/v1/onesay.php",
                icon = "💬",
                isRecommended = true
            )
        )
    }
    
    /**
     * 获取所有本地工具
     */
    fun getAllTools(): List<Tool> {
        return TOOLS
    }
    
    /**
     * 根据ID获取工具
     */
    fun getToolById(id: String): Tool? {
        return TOOLS.find { it.id == id }
    }
    
    /**
     * 搜索工具
     */
    fun searchTools(query: String): List<Tool> {
        return TOOLS.filter { 
            it.name.contains(query, ignoreCase = true) || 
            it.description.contains(query, ignoreCase = true)
        }
    }
    
    /**
     * 获取推荐工具
     */
    fun getRecommendedTools(): List<Tool> {
        return TOOLS.filter { it.isRecommended }
    }
    
    /**
     * 调用历史上的今天API
     * @param month 月份（可选）
     * @param day 日期（可选）
     */
    suspend fun getTodayInHistory(month: Int? = null, day: Int? = null): String {
        return withContext(Dispatchers.IO) {
            try {
                val url = if (month != null && day != null) {
                    "https://zeapi.ink/v1/today.php?month=$month&day=$day"
                } else {
                    "https://zeapi.ink/v1/today.php"
                }
                
                val request = Request.Builder()
                    .url(url)
                    .build()
                
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
    
    /**
     * 调用随机一言API
     */
    suspend fun getRandomQuote(): String {
        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("https://zeapi.ink/v1/onesay.php")
                    .build()
                
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
     * 执行工具功能
     * @param toolId 工具ID
     * @param params 参数（可选）
     */
    suspend fun executeTool(toolId: String, params: Map<String, Any>? = null): String {
        return when (toolId) {
            "today_in_history" -> {
                val month = params?.get("month") as? Int
                val day = params?.get("day") as? Int
                getTodayInHistory(month, day)
            }
            "random_quote" -> {
                getRandomQuote()
            }
            else -> "未知的工具ID：$toolId"
        }
    }
}