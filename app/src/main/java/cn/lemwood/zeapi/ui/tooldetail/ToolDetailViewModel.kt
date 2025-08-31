package cn.lemwood.zeapi.ui.tooldetail

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import cn.lemwood.zeapi.data.SharedPreferencesManager
import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.repository.ZeApiRepository
import kotlinx.coroutines.launch

class ToolDetailViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ZeApiRepository()
    private val sharedPreferencesManager = SharedPreferencesManager(application)
    
    private val _tool = MutableLiveData<Tool?>()
    val tool: LiveData<Tool?> = _tool
    
    private val _toolDetails = MutableLiveData<String?>()
    val toolDetails: LiveData<String?> = _toolDetails
    
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading
    
    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error
    
    init {
        // 初始化时更新仓库的请求头
        updateRepositoryHeaders()
    }
    
    fun loadToolDetails(toolId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                // 更新请求头
                updateRepositoryHeaders()
                val headers = getCurrentHeaders()
                
                // 获取工具详情
                val result = repository.getToolDetail(headers, toolId)
                
                if (result.isSuccess) {
                    val toolDetail = result.getOrNull()
                    if (toolDetail != null) {
                        _tool.value = toolDetail
                        _toolDetails.value = toolDetail.description
                    } else {
                        _error.value = "工具详情不存在"
                    }
                } else {
                    val errorMessage = result.exceptionOrNull()?.message ?: "加载工具详情失败"
                    _error.value = errorMessage
                    
                    // 使用模拟数据作为后备
                    loadMockToolDetail(toolId)
                }
            } catch (e: Exception) {
                _error.value = "加载工具详情失败: ${e.message}"
                
                // 使用模拟数据作为后备
                loadMockToolDetail(toolId)
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun loadToolDetailsByUrl(toolUrl: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                // 从URL中提取工具ID或直接使用URL
                val toolId = extractToolIdFromUrl(toolUrl) ?: toolUrl
                loadToolDetails(toolId)
            } catch (e: Exception) {
                _error.value = "无效的工具链接"
                _isLoading.value = false
            }
        }
    }
    
    /**
     * 从URL中提取工具ID
     */
    private fun extractToolIdFromUrl(url: String): String? {
        return try {
            // 假设URL格式为 https://zeapi.link/tool/{id}
            val segments = url.split("/")
            segments.lastOrNull()
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * 加载模拟工具详情
     */
    private fun loadMockToolDetail(toolId: String) {
        val mockTool = getMockToolDetail(toolId)
        if (mockTool != null) {
            _tool.value = mockTool
            _toolDetails.value = mockTool.description + "\n\n这是一个功能强大的在线工具，提供便捷的操作界面和丰富的功能选项。"
        } else {
            _error.value = "未找到工具信息"
        }
    }
    
    /**
     * 更新仓库的请求头
     */
    private fun updateRepositoryHeaders() {
        val headers = getCurrentHeaders()
        repository.updateHeaders(headers)
    }
    
    /**
     * 获取当前请求头
     */
    private fun getCurrentHeaders(): Map<String, String> {
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
                val jsonObject = org.json.JSONObject(customHeaders)
                val keys = jsonObject.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val value = jsonObject.getString(key)
                    headers[key] = value
                }
            } catch (e: Exception) {
                // 忽略解析错误
            }
        }
        
        return headers
    }
    
    /**
     * 获取模拟工具详情
     */
    private fun getMockToolDetail(toolId: String): Tool? {
        val mockTools = mapOf(
            "1" to Tool(
                id = "1",
                name = "文本处理",
                description = "提供各种文本处理功能，包括格式转换、编码解码、文本分析等多种实用功能",
                category = "文本工具",
                url = "https://zeapi.link/text",
                isRecommended = true
            ),
            "2" to Tool(
                id = "2",
                name = "图片处理",
                description = "支持图片格式转换、压缩、裁剪、滤镜等多种图片处理功能",
                category = "图片工具",
                url = "https://zeapi.link/image",
                isRecommended = true
            ),
            "3" to Tool(
                id = "3",
                name = "网络工具",
                description = "提供IP查询、网络测试、域名解析、端口扫描等网络相关工具",
                category = "网络工具",
                url = "https://zeapi.link/network",
                isRecommended = true
            )
        )
        
        return mockTools[toolId]
    }
}