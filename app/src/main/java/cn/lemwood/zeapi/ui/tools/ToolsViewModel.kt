package cn.lemwood.zeapi.ui.tools

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import cn.lemwood.zeapi.data.SharedPreferencesManager
import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.repository.ZeApiRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ToolsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ZeApiRepository()
    private val sharedPreferencesManager = SharedPreferencesManager(application)
    
    private val _tools = MutableLiveData<List<Tool>>()
    val tools: LiveData<List<Tool>> = _tools
    
    private val _filteredTools = MutableLiveData<List<Tool>>()
    val filteredTools: LiveData<List<Tool>> = _filteredTools
    
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading
    
    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error
    
    private var currentSearchQuery = ""
    private var searchJob: Job? = null
    private var currentPage = 1
    private var isLoadingMore = false
    
    init {
        // 初始化时更新仓库的请求头
        updateRepositoryHeaders()
    }
    
    fun loadTools() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            currentPage = 1
            
            try {
                // 更新请求头
                updateRepositoryHeaders()
                
                // 获取当前请求头
                val headers = getCurrentHeaders()
                
                // 加载工具列表
                val result = repository.getTools(headers, currentPage)
                
                if (result.isSuccess) {
                    val toolsList = result.getOrNull() ?: emptyList()
                    _tools.value = toolsList
                    
                    // 如果有搜索查询，应用过滤
                    if (currentSearchQuery.isNotEmpty()) {
                        filterToolsLocally(currentSearchQuery)
                    } else {
                        _filteredTools.value = toolsList
                    }
                } else {
                    val errorMessage = result.exceptionOrNull()?.message ?: "加载工具失败"
                    _error.value = errorMessage
                    
                    // 使用模拟数据作为后备
                    val mockTools = getMockTools()
                    _tools.value = mockTools
                    _filteredTools.value = mockTools
                }
            } catch (e: Exception) {
                _error.value = "加载工具失败: ${e.message}"
                
                // 使用模拟数据作为后备
                val mockTools = getMockTools()
                _tools.value = mockTools
                _filteredTools.value = mockTools
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun refreshTools() {
        loadTools()
    }
    
    fun loadMoreTools() {
        if (isLoadingMore || _isLoading.value == true) return
        
        viewModelScope.launch {
            isLoadingMore = true
            
            try {
                val headers = getCurrentHeaders()
                val result = repository.getTools(headers, currentPage + 1)
                
                if (result.isSuccess) {
                    val newTools = result.getOrNull() ?: emptyList()
                    if (newTools.isNotEmpty()) {
                        val currentTools = _tools.value ?: emptyList()
                        val updatedTools = currentTools + newTools
                        _tools.value = updatedTools
                        currentPage++
                        
                        // 如果有搜索查询，重新应用过滤
                        if (currentSearchQuery.isNotEmpty()) {
                            filterToolsLocally(currentSearchQuery)
                        } else {
                            _filteredTools.value = updatedTools
                        }
                    }
                }
            } catch (e: Exception) {
                // 静默处理加载更多的错误
            } finally {
                isLoadingMore = false
            }
        }
    }
    
    fun searchTools(query: String) {
        currentSearchQuery = query
        
        // 取消之前的搜索任务
        searchJob?.cancel()
        
        if (query.isEmpty()) {
            _filteredTools.value = _tools.value ?: emptyList()
            return
        }
        
        // 防抖搜索
        searchJob = viewModelScope.launch {
            delay(500) // 500ms 防抖延迟
            
            try {
                // 更新请求头
                updateRepositoryHeaders()
                val headers = getCurrentHeaders()
                
                // 首先尝试服务器端搜索
                val result = repository.searchTools(headers, query)
                
                if (result.isSuccess) {
                    val searchResults = result.getOrNull() ?: emptyList()
                    _filteredTools.value = searchResults
                } else {
                    // 如果服务器端搜索失败，使用本地过滤
                    filterToolsLocally(query)
                }
            } catch (e: Exception) {
                // 如果网络搜索失败，使用本地过滤
                filterToolsLocally(query)
            }
        }
    }
    
    /**
     * 本地过滤工具
     */
    private fun filterToolsLocally(query: String) {
        val allTools = _tools.value ?: return
        
        val filtered = allTools.filter { tool ->
            tool.name.contains(query, ignoreCase = true) ||
            tool.description.contains(query, ignoreCase = true) ||
            tool.category.contains(query, ignoreCase = true)
        }
        _filteredTools.value = filtered
    }
    
    fun onToolClicked(tool: Tool) {
        // TODO: 处理工具点击事件
        // 可以通过Intent打开浏览器访问工具URL
        // 或者打开工具详情页面
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
     * 获取模拟工具数据
     */
    private fun getMockTools(): List<Tool> {
        return listOf(
            Tool(
                id = "1",
                name = "文本处理",
                description = "提供各种文本处理功能，包括格式转换、编码解码等",
                category = "文本工具",
                url = "https://zeapi.link/text",
                isRecommended = true
            ),
            Tool(
                id = "2",
                name = "图片处理",
                description = "图片格式转换、压缩、裁剪等功能",
                category = "图片工具",
                url = "https://zeapi.link/image",
                isRecommended = true
            ),
            Tool(
                id = "3",
                name = "网络工具",
                description = "IP查询、网络测试、域名解析等",
                category = "网络工具",
                url = "https://zeapi.link/network",
                isRecommended = true
            ),
            Tool(
                id = "4",
                name = "加密解密",
                description = "各种加密解密算法，哈希计算等",
                category = "安全工具",
                url = "https://zeapi.link/crypto"
            ),
            Tool(
                id = "5",
                name = "时间工具",
                description = "时间戳转换、时区转换等时间相关工具",
                category = "时间工具",
                url = "https://zeapi.link/time"
            ),
            Tool(
                id = "6",
                name = "JSON工具",
                description = "JSON格式化、验证、转换等功能",
                category = "开发工具",
                url = "https://zeapi.link/json"
            ),
            Tool(
                id = "7",
                name = "二维码生成",
                description = "生成各种类型的二维码",
                category = "生成工具",
                url = "https://zeapi.link/qrcode"
            ),
            Tool(
                id = "8",
                name = "颜色工具",
                description = "颜色转换、调色板、颜色搭配等",
                category = "设计工具",
                url = "https://zeapi.link/color"
            ),
            Tool(
                id = "9",
                name = "Base64编解码",
                description = "Base64编码和解码工具",
                category = "编码工具",
                url = "https://zeapi.link/base64"
            ),
            Tool(
                id = "10",
                name = "URL编解码",
                description = "URL编码和解码工具",
                category = "编码工具",
                url = "https://zeapi.link/url"
            )
        )
    }
}