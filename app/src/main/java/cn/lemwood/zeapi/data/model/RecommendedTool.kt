package cn.lemwood.zeapi.data.model

import com.google.gson.annotations.SerializedName

data class RecommendedTool(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("description")
    val description: String,
    
    @SerializedName("icon")
    val icon: String,
    
    @SerializedName("category")
    val category: String,
    
    @SerializedName("api_endpoint")
    val apiEndpoint: String,
    
    @SerializedName("featured")
    val featured: Boolean = false,
    
    @SerializedName("order")
    val order: Int = 0
)

data class RecommendedToolsResponse(
    @SerializedName("recommended_tools")
    val recommendedTools: List<RecommendedTool>
)