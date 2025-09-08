package cn.lemwood.zeapi.data.local

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * 舔狗日记工具类
 * 负责处理舔狗日记获取功能
 */
class TianGouDiaryTool(context: Context) : BaseToolService(context) {
    
    private val httpClient = OkHttpClient()
    private val toolName = "舔狗日记"
    
    /**
     * 获取随机舔狗日记
     */
    suspend fun getTianGouDiary(): String {
        return withContext(Dispatchers.IO) {
            try {
                logToolExecution(toolName, "GET_DIARY", "开始获取舔狗日记")
                
                val headers = getRequestHeaders()
                val requestBuilder = Request.Builder()
                    .url("https://zeapi.ink/v1/api/tgrj")
                    .get()
                
                // 添加请求头
                headers.forEach { (key, value) ->
                    requestBuilder.addHeader(key, value)
                }
                
                val request = requestBuilder.build()
                val response = httpClient.newCall(request).execute()
                
                if (response.isSuccessful) {
                    val result = response.body?.string() ?: "获取失败"
                    logToolExecution(toolName, "GET_DIARY", "获取成功，内容长度: ${result.length}")
                    result
                } else {
                    val errorMsg = "请求失败，状态码: ${response.code}"
                    logToolExecution(toolName, "GET_DIARY", errorMsg)
                    errorMsg
                }
            } catch (e: Exception) {
                val errorMsg = "网络请求异常: ${e.message}"
                logToolExecution(toolName, "GET_DIARY", errorMsg)
                errorMsg
            }
        }
    }
    
    /**
     * 使用参数Map执行工具（舔狗日记无需参数）
     * @param params 参数Map（此工具忽略所有参数）
     */
    suspend fun execute(params: Map<String, String>): String {
        return try {
            logToolExecution(toolName, "EXECUTE", "开始执行舔狗日记工具")
            getTianGouDiary()
        } catch (e: Exception) {
            val errorMsg = "执行失败: ${e.message}"
            logToolExecution(toolName, "EXECUTE", errorMsg)
            errorMsg
        }
    }
}