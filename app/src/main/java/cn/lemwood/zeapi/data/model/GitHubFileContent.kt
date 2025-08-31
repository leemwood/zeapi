package cn.lemwood.zeapi.data.model

import com.google.gson.annotations.SerializedName

/**
 * GitHub文件内容响应数据类
 * 用于处理GitHub API返回的文件内容
 */
data class GitHubFileContent(
    @SerializedName("name")
    val name: String,
    
    @SerializedName("path")
    val path: String,
    
    @SerializedName("sha")
    val sha: String,
    
    @SerializedName("size")
    val size: Int,
    
    @SerializedName("url")
    val url: String,
    
    @SerializedName("html_url")
    val htmlUrl: String,
    
    @SerializedName("git_url")
    val gitUrl: String,
    
    @SerializedName("download_url")
    val downloadUrl: String?,
    
    @SerializedName("type")
    val type: String,
    
    @SerializedName("content")
    val content: String,
    
    @SerializedName("encoding")
    val encoding: String
)

/**
 * 公告列表响应数据类
 * 用于解析announcements.json文件内容
 */
data class AnnouncementsResponse(
    @SerializedName("announcements")
    val announcements: List<Announcement>
)