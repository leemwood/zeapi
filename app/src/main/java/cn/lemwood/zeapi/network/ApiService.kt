package cn.lemwood.zeapi.network

import cn.lemwood.zeapi.data.model.Announcement
import cn.lemwood.zeapi.data.model.Tool
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.HeaderMap
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * zeapi.link API 服务接口
 */
interface ApiService {
    
    /**
     * 获取GitHub仓库的公告信息
     * 通过GitHub API获取仓库的README或releases信息
     */
    @GET("repos/leemwood/zeapi/releases/latest")
    suspend fun getLatestRelease(@HeaderMap headers: Map<String, String>): Response<GitHubRelease>
    
    /**
     * 获取GitHub仓库的README内容
     */
    @GET("repos/leemwood/zeapi/readme")
    suspend fun getReadme(@HeaderMap headers: Map<String, String>): Response<GitHubReadme>
    
    /**
     * 获取工具列表
     * 这里假设zeapi.link提供了工具列表的API端点
     */
    @GET("api/tools")
    suspend fun getTools(
        @HeaderMap headers: Map<String, String>,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<ToolsResponse>
    
    /**
     * 搜索工具
     */
    @GET("api/tools/search")
    suspend fun searchTools(
        @HeaderMap headers: Map<String, String>,
        @Query("q") query: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<ToolsResponse>
    
    /**
     * 获取推荐工具
     */
    @GET("api/tools/recommended")
    suspend fun getRecommendedTools(
        @HeaderMap headers: Map<String, String>,
        @Query("limit") limit: Int = 10
    ): Response<ToolsResponse>
    
    /**
     * 获取工具详情
     */
    @GET("api/tools/{id}")
    suspend fun getToolDetail(
        @Path("id") toolId: String,
        @HeaderMap headers: Map<String, String>
    ): Response<Tool>
}

/**
 * GitHub Release 响应数据类
 */
data class GitHubRelease(
    val tag_name: String,
    val name: String,
    val body: String,
    val published_at: String,
    val html_url: String
)

/**
 * GitHub README 响应数据类
 */
data class GitHubReadme(
    val content: String,
    val encoding: String
)

/**
 * 工具列表响应数据类
 */
data class ToolsResponse(
    val success: Boolean,
    val data: List<Tool>,
    val total: Int,
    val page: Int,
    val limit: Int,
    val message: String? = null
)