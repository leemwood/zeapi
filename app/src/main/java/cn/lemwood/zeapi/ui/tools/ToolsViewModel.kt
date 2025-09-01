package cn.lemwood.zeapi.ui.tools

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope

import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.service.LocalToolService
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ToolsViewModel(application: Application) : AndroidViewModel(application) {

    private val localToolService = LocalToolService(application.applicationContext)

    
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
        // 初始化时加载工具
        loadTools()
    }
    
    fun loadTools() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            currentPage = 1
            
            try {
                // 直接从本地服务获取工具列表
                val toolsList = localToolService.getAllTools()
                _tools.value = toolsList
                
                // 如果有搜索查询，应用过滤
                if (currentSearchQuery.isNotEmpty()) {
                    filterToolsLocally(currentSearchQuery)
                } else {
                    _filteredTools.value = toolsList
                }
            } catch (e: Exception) {
                _error.value = "加载工具失败: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun refreshTools() {
        loadTools()
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
            
            // 直接使用本地过滤
            filterToolsLocally(query)
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
}