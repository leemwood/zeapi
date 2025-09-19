package cn.lemwood.zeapi.service

import android.content.Context
import cn.lemwood.zeapi.data.local.TodayInHistoryTool
import cn.lemwood.zeapi.data.local.RandomQuoteTool
import cn.lemwood.zeapi.data.local.QRCodeGeneratorTool
import cn.lemwood.zeapi.data.local.TianGouDiaryTool
import cn.lemwood.zeapi.data.local.RandomAnimeImageTool
import cn.lemwood.zeapi.data.model.Tool

/**
 * 本地工具服务类
 * 使用独立的工具类实现各种功能，支持请求头配置
 */
class LocalToolService(private val context: Context) {
    
    // 工具类实例
    private val todayInHistoryTool = TodayInHistoryTool(context)
    private val randomQuoteTool = RandomQuoteTool(context)
    private val qrCodeGeneratorTool = QRCodeGeneratorTool(context)
    private val tianGouDiaryTool = TianGouDiaryTool(context)
    private val randomAnimeImageTool = RandomAnimeImageTool(context)
    
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
            ),
            Tool(
                id = "qrcode_generator",
                name = "二维码生成",
                description = "生成二维码图片，支持自定义尺寸和格式",
                category = "工具",
                url = "https://zeapi.ink/v1/qrcode.php",
                icon = "📱",
                isRecommended = true
            ),
            Tool(
                id = "tiangou_diary",
                name = "舔狗日记",
                description = "获取随机舔狗日记，共收录3.9k条内容",
                category = "娱乐",
                url = "https://zeapi.ink/v1/api/tgrj",
                icon = "💔",
                isRecommended = true
            ),
            Tool(
                id = "random_anime_image",
                name = "随机二次元图片",
                description = "获取随机二次元图片，支持直接显示和JSON信息格式",
                category = "图片",
                url = "https://zeapi.ink/v1/api/sjecy",
                icon = "🎨",
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
        return todayInHistoryTool.getTodayInHistory(month, day)
    }
    
    /**
     * 调用历史上的今天API
     * @param dateParam 日期参数，格式：MM-DD
     */
    suspend fun getTodayInHistory(dateParam: String): String {
        return todayInHistoryTool.getTodayInHistory(dateParam)
    }
    
    /**
     * 调用历史上的今天API（无参数版本）
     */
    suspend fun getTodayInHistory(): String {
        return todayInHistoryTool.getTodayInHistory()
    }
    
    /**
     * 调用随机一言API
     */
    suspend fun getRandomQuote(): String {
        return randomQuoteTool.getRandomQuote()
    }
    
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
        return qrCodeGeneratorTool.generateQRCode(text, size, margin, format)
    }
    
    /**
     * 获取舔狗日记
     */
    suspend fun getTianGouDiary(): String {
        return tianGouDiaryTool.getTianGouDiary()
    }
    
    /**
     * 获取随机二次元图片
     */
    suspend fun getRandomAnimeImage(): Any {
        val result = randomAnimeImageTool.getRandomAnimeImage()
        return result.getOrElse { "获取图片失败: ${it.message}" }
    }
    
    /**
     * 获取随机二次元图片信息（JSON格式）
     */
    suspend fun getRandomAnimeImageInfo(): Any {
        val result = randomAnimeImageTool.getRandomAnimeImageInfo()
        return result.getOrElse { "获取图片信息失败: ${it.message}" }
    }
    
    /**
     * 执行工具功能
     * @param toolId 工具ID
     * @param params 参数（可选）
     */
    suspend fun executeTool(toolId: String, params: Map<String, Any>? = null): String {
        // 将Any类型的参数转换为String类型
        val stringParams = params?.mapValues { it.value.toString() } ?: emptyMap()
        
        return when (toolId) {
            "today_in_history" -> {
                todayInHistoryTool.execute(stringParams)
            }
            "random_quote" -> {
                randomQuoteTool.execute(stringParams)
            }
            "qrcode_generator" -> {
                qrCodeGeneratorTool.execute(stringParams)
            }
            "tiangou_diary" -> {
                tianGouDiaryTool.execute(stringParams)
            }
            "random_anime_image" -> {
                randomAnimeImageTool.execute(stringParams)
            }
            else -> "未知的工具ID：$toolId"
        }
    }
}