package cn.lemwood.zeapi.repository

import android.util.Base64
import cn.lemwood.zeapi.data.model.Announcement
import cn.lemwood.zeapi.data.model.AnnouncementsResponse
import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.network.ApiService
import cn.lemwood.zeapi.network.NetworkClient
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

/**
 * zeapi 数据仓库
 */
class ZeApiRepository {
    
    private val networkClient = NetworkClient.getInstance()
    private val zeApiService: ApiService by lazy { networkClient.createZeApiService() }
    private val gitHubApiService: ApiService by lazy { networkClient.createGitHubApiService() }
    
    /**
     * 更新请求头
     */
    fun updateHeaders(headers: Map<String, String>) {
        networkClient.updateHeaders(headers)
    }
    
    /**
     * 获取GitHub公告
     * 优先从仓库的announcements.json文件获取，失败时使用备用方案
     */
    suspend fun getAnnouncements(headers: Map<String, String>): Result<List<Announcement>> {
        return withContext(Dispatchers.IO) {
            try {
                // 首先尝试从仓库的JSON文件获取公告
                val jsonResponse = gitHubApiService.getAnnouncementsJson(headers)
                if (jsonResponse.isSuccessful) {
                    val fileContent = jsonResponse.body()
                    fileContent?.let {
                        try {
                            // 解码Base64内容
                            val jsonContent = if (it.encoding == "base64") {
                                String(Base64.decode(it.content.replace("\n", ""), Base64.DEFAULT))
                            } else {
                                it.content
                            }
                            
                            // 解析JSON内容
                            val gson = Gson()
                            val announcementsResponse = gson.fromJson(jsonContent, AnnouncementsResponse::class.java)
                            
                            // 如果成功获取到公告数据，直接返回
                            if (announcementsResponse.announcements.isNotEmpty()) {
                                return@withContext Result.success(announcementsResponse.announcements)
                            }
                        } catch (e: Exception) {
                            // JSON解析失败，继续使用备用方案
                        }
                    }
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
     * 获取工具列表
     */
    suspend fun getTools(headers: Map<String, String>, page: Int = 1): Result<List<Tool>> {
        return withContext(Dispatchers.IO) {
            try {
                val response = zeApiService.getTools(headers, page)
                if (response.isSuccessful) {
                    val toolsResponse = response.body()
                    if (toolsResponse?.success == true) {
                        Result.success(toolsResponse.data)
                    } else {
                        Result.failure(Exception(toolsResponse?.message ?: "获取工具列表失败"))
                    }
                } else {
                    Result.failure(Exception("网络请求失败: ${response.code()}"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 获取推荐工具
     */
    suspend fun getRecommendedTools(headers: Map<String, String>): Result<List<Tool>> {
        return withContext(Dispatchers.IO) {
            try {
                val response = zeApiService.getRecommendedTools(headers)
                if (response.isSuccessful) {
                    val toolsResponse = response.body()
                    if (toolsResponse?.success == true) {
                        Result.success(toolsResponse.data)
                    } else {
                        Result.failure(Exception(toolsResponse?.message ?: "获取推荐工具失败"))
                    }
                } else {
                    Result.failure(Exception("网络请求失败: ${response.code()}"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 搜索工具
     */
    suspend fun searchTools(headers: Map<String, String>, query: String, page: Int = 1): Result<List<Tool>> {
        return withContext(Dispatchers.IO) {
            try {
                val response = zeApiService.searchTools(headers, query, page)
                if (response.isSuccessful) {
                    val toolsResponse = response.body()
                    if (toolsResponse?.success == true) {
                        Result.success(toolsResponse.data)
                    } else {
                        Result.failure(Exception(toolsResponse?.message ?: "搜索工具失败"))
                    }
                } else {
                    Result.failure(Exception("网络请求失败: ${response.code()}"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    /**
     * 获取工具详情
     */
    suspend fun getToolDetail(headers: Map<String, String>, toolId: String): Result<Tool> {
        return withContext(Dispatchers.IO) {
            try {
                val response = zeApiService.getToolDetail(toolId, headers)
                if (response.isSuccessful) {
                    val tool = response.body()
                    if (tool != null) {
                        Result.success(tool)
                    } else {
                        Result.failure(Exception("工具详情为空"))
                    }
                } else {
                    Result.failure(Exception("网络请求失败: ${response.code()}"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
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
            val lines = content.split("\n")
            val title = lines.firstOrNull { it.startsWith("#") }?.removePrefix("#")?.trim()
            val description = lines.take(10).joinToString("\n")
            
            if (title != null) {
                Announcement(
                    id = "readme_announcement",
                    title = title,
                    content = description,
                    date = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date()),
                    author = "柠枺",
                    isImportant = false
                )
            } else null
        } catch (e: Exception) {
            null
        }
    }
}