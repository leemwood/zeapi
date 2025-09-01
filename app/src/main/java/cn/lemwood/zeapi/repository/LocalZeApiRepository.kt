package cn.lemwood.zeapi.repository

import android.util.Base64
import cn.lemwood.zeapi.data.model.Announcement
import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.network.ApiService
import cn.lemwood.zeapi.network.NetworkClient
import cn.lemwood.zeapi.service.LocalToolService
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

/**
 * 本地zeapi数据仓库
 * 使用本地硬编码的工具，只保留GitHub公告获取功能
 */
class LocalZeApiRepository(private val context: android.content.Context) {
    
    private val networkClient = NetworkClient.getInstance()
    private val gitHubApiService: ApiService by lazy { networkClient.createGitHubApiService() }
    private val backupGitHubApiService: ApiService by lazy { networkClient.createBackupGitHubApiService() }
    private val localToolService = LocalToolService(context)
    
    /**
     * 更新请求头
     */
    fun updateHeaders(headers: Map<String, String>) {
        networkClient.updateHeaders(headers)
    }
    
    /**
     * 获取GitHub公告
     * 从仓库的announcements.json文件获取，失败时使用备用方案
     */
    suspend fun getAnnouncements(headers: Map<String, String>): Result<List<Announcement>> {
        return withContext(Dispatchers.IO) {
            try {
                // 首先尝试从主 GitHub API 获取 JSON 文件
                val mainApiResult = tryGetAnnouncementsFromJson(gitHubApiService, headers)
                if (mainApiResult != null) {
                    return@withContext Result.success(mainApiResult)
                }
                
                // 如果主 API 失败，尝试备用 GitHub API
                val backupApiResult = tryGetAnnouncementsFromJson(backupGitHubApiService, headers)
                if (backupApiResult != null) {
                    return@withContext Result.success(backupApiResult)
                }
                
                // 备用方案：从GitHub Release和README获取公告
                val announcements = mutableListOf<Announcement>()
                
                // 尝试获取最新发布信息
                val releaseResponse = gitHubApiService.getLatestRelease(headers)
                if (releaseResponse.isSuccessful) {
                    val release = releaseResponse.body()
                    release?.let {
                        announcements.add(
                            Announcement(
                                id = "release_${it.tag_name}",
                                title = "新版本发布: ${it.name}",
                                content = it.body,
                                date = parseGitHubDate(it.published_at),
                                author = "柠枺",
                                isImportant = true
                            )
                        )
                    }
                }
                
                // 尝试获取README内容作为公告
                val readmeResponse = gitHubApiService.getReadme(headers)
                if (readmeResponse.isSuccessful) {
                    val readme = readmeResponse.body()
                    readme?.let {
                        val content = if (it.encoding == "base64") {
                            String(Base64.decode(it.content.replace("\n", ""), Base64.DEFAULT))
                        } else {
                            it.content
                        }
                        
                        // 提取README中的重要信息作为公告
                        val announcement = extractAnnouncementFromReadme(content)
                        if (announcement != null) {
                            announcements.add(announcement)
                        }
                    }
                }
                
                Result.success(announcements)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 获取本地工具列表
     */
    suspend fun getTools(headers: Map<String, String>, page: Int = 1): Result<List<Tool>> {
        return withContext(Dispatchers.IO) {
            try {
                val tools = localToolService.getAllTools()
                Result.success(tools)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 获取推荐工具（本地硬编码）
     */
    suspend fun getRecommendedTools(headers: Map<String, String>): Result<List<Tool>> {
        return withContext(Dispatchers.IO) {
            try {
                val tools = localToolService.getRecommendedTools()
                Result.success(tools)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 搜索工具（本地搜索）
     */
    suspend fun searchTools(headers: Map<String, String>, query: String, page: Int = 1): Result<List<Tool>> {
        return withContext(Dispatchers.IO) {
            try {
                val tools = localToolService.searchTools(query)
                Result.success(tools)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 获取工具详情（本地获取）
     */
    suspend fun getToolDetail(headers: Map<String, String>, toolId: String): Result<Tool> {
        return withContext(Dispatchers.IO) {
            try {
                val tool = localToolService.getToolById(toolId)
                if (tool != null) {
                    Result.success(tool)
                } else {
                    Result.failure(Exception("工具不存在：$toolId"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 执行本地工具
     */
    suspend fun executeTool(toolId: String, params: Map<String, Any>? = null): Result<String> {
        return withContext(Dispatchers.IO) {
            try {
                val result = localToolService.executeTool(toolId, params)
                Result.success(result)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    // ==================== 私有辅助方法 ====================
    
    /**
     * 尝试从GitHub API获取公告JSON文件
     * @param apiService GitHub API 服务实例（主服务或备用服务）
     * @param headers 请求头
     * @return 公告列表，如果失败返回null
     */
    private suspend fun tryGetAnnouncementsFromJson(apiService: ApiService, headers: Map<String, String>): List<Announcement>? {
        return try {
            val jsonResponse = apiService.getAnnouncementsJson(headers)
            if (jsonResponse.isSuccessful) {
                val fileContent = jsonResponse.body()
                fileContent?.let {
                    val content = if (it.encoding == "base64") {
                        String(Base64.decode(it.content.replace("\n", ""), Base64.DEFAULT))
                    } else {
                        it.content
                    }
                    
                    val gson = Gson()
                    val announcementsResponse = gson.fromJson(content, AnnouncementsResponse::class.java)
                    announcementsResponse.announcements
                }
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * 解析GitHub日期格式
     */
    private fun parseGitHubDate(dateString: String): String {
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
            val outputFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
            val date = inputFormat.parse(dateString)
            outputFormat.format(date ?: Date())
        } catch (e: Exception) {
            dateString
        }
    }
    
    /**
     * 从README内容中提取公告信息
     */
    private fun extractAnnouncementFromReadme(content: String): Announcement? {
        return try {
            // 简单提取README的前几行作为公告
            val lines = content.split("\n").take(10)
            val title = lines.find { it.startsWith("#") }?.removePrefix("#")?.trim() ?: "项目说明"
            val description = lines.filter { it.isNotBlank() && !it.startsWith("#") }.take(3).joinToString("\n")
            
            if (description.isNotBlank()) {
                Announcement(
                    id = "readme_${System.currentTimeMillis()}",
                    title = title,
                    content = description,
                    date = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date()),
                    author = "柠枺",
                    isImportant = false
                )
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}

/**
 * 公告响应数据类
 */
data class AnnouncementsResponse(
    val announcements: List<Announcement>
)