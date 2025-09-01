package cn.lemwood.zeapi.data.local

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder

/**
 * 二维码生成工具类
 * 负责处理二维码生成功能
 */
class QRCodeGeneratorTool(context: Context) : BaseToolService(context) {
    
    private val httpClient = OkHttpClient()
    private val toolName = "二维码生成"
    
    /**
     * 生成二维码
     * @param text 要编码的文本内容
     * @param size QR码图片尺寸（像素，宽高相等）
     * @param margin QR码边距（像素）
     * @param format 图片格式（jpg、png等）
     */
    suspend fun generateQRCode(
        text: String,
        size: Int = 100,
        margin: Int = 4,
        format: String = "jpg"
    ): String {
        return withContext(Dispatchers.IO) {
            try {
                val encodedText = URLEncoder.encode(text, "UTF-8")
                val url = "https://zeapi.ink/v1/api/qrcode?text=$encodedText&size=$size&margin=$margin&format=$format"
                
                logToolExecution(toolName, "REQUEST", "请求URL: $url")
                
                val requestBuilder = Request.Builder().url(url)
                
                // 添加配置的请求头
                val headers = getCurrentHeaders()
                headers.forEach { (key, value) ->
                    requestBuilder.addHeader(key, value)
                }
                
                val request = requestBuilder.build()
                val response = httpClient.newCall(request).execute()
                
                if (response.isSuccessful) {
                    response.body?.string() ?: "生成二维码失败"
                } else {
                    "网络请求失败：${response.code}"
                }
            } catch (e: Exception) {
                "请求失败：${e.message}"
            }
        }
    }
    
    /**
     * 使用参数Map执行工具
     * @param params 参数Map，支持text、size、margin、format参数
     */
    suspend fun execute(params: Map<String, String>): String {
        return try {
            logToolExecution(toolName, "EXECUTE", "开始执行，参数: $params")
            
            // 验证必需参数
            if (!validateRequiredParams(params, listOf("text"))) {
                return "缺少必需参数：text（要编码的文本内容）"
            }
            
            val text = params["text"]!!
            val size = params["size"]?.toIntOrNull() ?: 100
            val margin = params["margin"]?.toIntOrNull() ?: 4
            val format = getParamOrDefault(params, "format", "jpg")
            
            // 参数验证
            if (text.isBlank()) {
                return "文本内容不能为空"
            }
            
            val result = generateQRCode(text, size, margin, format)
            logToolExecution(toolName, "SUCCESS", "执行成功")
            result
        } catch (e: Exception) {
            handleToolException(toolName, e)
        }
    }
}