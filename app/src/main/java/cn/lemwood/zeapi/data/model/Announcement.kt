package cn.lemwood.zeapi.data.model

data class Announcement(
    val id: String,
    val title: String,
    val content: String,
    val date: String,
    val author: String = "柠枺",
    val isImportant: Boolean = false
)
