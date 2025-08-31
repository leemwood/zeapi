package cn.lemwood.zeapi.data.model

data class Tool(
    val id: String,
    val name: String,
    val description: String,
    val category: String,
    val url: String,
    val icon: String? = null,
    val isRecommended: Boolean = false
)
