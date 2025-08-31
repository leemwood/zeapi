package cn.lemwood.zeapi.ui.home

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import cn.lemwood.zeapi.data.SharedPreferencesManager
import cn.lemwood.zeapi.data.model.Announcement
import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.repository.ZeApiRepository
import kotlinx.coroutines.launch
import kotlinx.coroutines.async

class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ZeApiRepository()
    private val sharedPreferencesManager = SharedPreferencesManager(application)
    
    private val _announcements = MutableLiveData<List<Announcement>>()
    val announcements: LiveData<List<Announcement>> = _announcements
    
    private val _recommendedTools = MutableLiveData<List<Tool>>()
    val recommendedTools: LiveData<List<Tool>> = _recommendedTools
    
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading
    
    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error
    
    init {
        // 初始化时更新仓库的请求头
        updateRepositoryHeaders()
    }
    
    fun loadData() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                // 更新请求头
                updateRepositoryHeaders()
                
                // 获取当前请求头
                val headers = getCurrentHeaders()
                
                // 并行加载公告和推荐工具
                val announcementsDeferred = viewModelScope.async { repository.getAnnouncements(headers) }
                val toolsDeferred = viewModelScope.async { repository.getRecommendedTools(headers) }
                
                // 处理公告结果
                val announcementsResult = announcementsDeferred.await()
                if (announcementsResult.isSuccess) {
                    _announcements.value = announcementsResult.getOrNull() ?: getMockAnnouncements()
                } else {
                    _announcements.value = getMockAnnouncements()
                }
                
                // 处理推荐工具结果
                val toolsResult = toolsDeferred.await()
                if (toolsResult.isSuccess) {
                    _recommendedTools.value = toolsResult.getOrNull() ?: getMockRecommendedTools()
                } else {
                    _recommendedTools.value = getMockRecommendedTools()
                }
                
            } catch (e: Exception) {
                _error.value = "加载数据失败: ${e.message}"
                // 使用模拟数据作为后备
                _announcements.value = getMockAnnouncements()
                _recommendedTools.value = getMockRecommendedTools()
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun refreshData() {
        loadData()
    }
    
    fun onToolClicked(tool: Tool) {
        // TODO: 处理工具点击事件
        // 可以通过Intent打开浏览器访问工具URL
    }
    
    fun onAnnouncementClicked(announcement: Announcement) {
        // TODO: 处理公告点击事件
        // 可以打开公告详情或跳转到相关链接
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
     * 获取模拟公告数据
     */
    private fun getMockAnnouncements(): List<Announcement> {
        return listOf(
            Announcement(
                id = "1",
                title = "欢迎使用 zeapi 工具集",
                content = "zeapi 提供了丰富的在线工具，包括文本处理、图片处理、网络工具等，让您的工作更加高效。",
                date = "2024-01-15 10:00"
            ),
            Announcement(
                id = "2",
                title = "新增多个实用工具",
                content = "最近新增了JSON格式化、二维码生成、颜色工具等多个实用功能，快来体验吧！",
                date = "2024-01-10 14:30"
            )
        )
    }
    
    /**
     * 获取模拟推荐工具数据
     */
    private fun getMockRecommendedTools(): List<Tool> {
        return listOf(
            Tool(
                id = "1",
                name = "文本处理",
                description = "提供各种文本处理功能",
                category = "文本工具",
                url = "https://zeapi.ink/text",
                isRecommended = true
            ),
            Tool(
                id = "2",
                name = "图片处理",
                description = "图片格式转换、压缩等",
                category = "图片工具",
                url = "https://zeapi.ink/image",
                isRecommended = true
            ),
            Tool(
                id = "3",
                name = "网络工具",
                description = "IP查询、网络测试等",
                category = "网络工具",
                url = "https://zeapi.ink/network",
                isRecommended = true
            ),
            Tool(
                id = "4",
                name = "加密解密",
                description = "各种加密解密算法",
                category = "安全工具",
                url = "https://zeapi.ink/crypto",
                isRecommended = true
            ),
            Tool(
                id = "5",
                name = "JSON工具",
                description = "JSON格式化、验证等",
                category = "开发工具",
                url = "https://zeapi.ink/json",
                isRecommended = true
            ),
            Tool(
                id = "6",
                name = "二维码生成",
                description = "生成各种类型的二维码",
                category = "生成工具",
                url = "https://zeapi.ink/qrcode",
                isRecommended = true
            )
        )
    }
    
    /**
     * 协程辅助函数
     */

}