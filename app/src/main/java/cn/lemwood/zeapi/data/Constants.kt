package cn.lemwood.zeapi.data

/**
 * 应用常量定义
 */
object Constants {
    
    // ========== API 地址 ==========
    
    /**
     * zeapi.link 主站地址
     */
    const val ZEAPI_BASE_URL = "https://zeapi.link/"
    
    /**
     * GitHub API 基础地址
     */
    const val GITHUB_API_BASE_URL = "https://api.github.com/"
    
    /**
     * 备用 GitHub API 地址
     */
    const val GITHUB_API_BACKUP_URL = "https://gayhub.lemwood.cn/"
    
    /**
     * GitHub 仓库地址
     */
    const val GITHUB_REPO_URL = "https://github.com/leemwood/zeapi"
    
    // ========== SharedPreferences 键名 ==========
    
    /**
     * SharedPreferences 文件名
     */
    const val PREFS_NAME = "zeapi_preferences"
    
    /**
     * 用户代理请求头键
     */
    const val KEY_USER_AGENT = "user_agent"
    
    /**
     * 授权请求头键
     */
    const val KEY_AUTHORIZATION = "authorization"
    
    /**
     * 自定义请求头键
     */
    const val KEY_CUSTOM_HEADERS = "custom_headers"
    
    /**
     * 首次启动标记键
     */
    const val KEY_FIRST_LAUNCH = "first_launch"
    
    /**
     * 最后更新检查时间键
     */
    const val KEY_LAST_UPDATE_CHECK = "last_update_check"
    
    // ========== 默认值 ==========
    
    /**
     * 默认 User-Agent
     */
    const val DEFAULT_USER_AGENT = "zeapi-android/1.0.0"
    
    /**
     * 默认请求超时时间（秒）
     */
    const val DEFAULT_TIMEOUT = 30L
    
    /**
     * 默认分页大小
     */
    const val DEFAULT_PAGE_SIZE = 20
    
    /**
     * 推荐工具数量
     */
    const val RECOMMENDED_TOOLS_COUNT = 6
    
    // ========== 应用信息 ==========
    
    /**
     * 应用名称
     */
    const val APP_NAME = "zeapi"
    
    /**
     * 应用包名
     */
    const val PACKAGE_NAME = "cn.lemwood.zeapi"
    
    /**
     * 作者昵称
     */
    const val AUTHOR_NAME = "柠枺"
    
    /**
     * 作者邮箱
     */
    const val AUTHOR_EMAIL = "3436464181@qq.com"
    
    /**
     * GitHub 用户名
     */
    const val GITHUB_USERNAME = "leemwood"
    
    /**
     * GitHub 仓库名
     */
    const val GITHUB_REPO_NAME = "zeapi"
    
    // ========== 网络相关 ==========
    
    /**
     * HTTP 状态码：成功
     */
    const val HTTP_OK = 200
    
    /**
     * HTTP 状态码：未授权
     */
    const val HTTP_UNAUTHORIZED = 401
    
    /**
     * HTTP 状态码：禁止访问
     */
    const val HTTP_FORBIDDEN = 403
    
    /**
     * HTTP 状态码：未找到
     */
    const val HTTP_NOT_FOUND = 404
    
    /**
     * HTTP 状态码：服务器错误
     */
    const val HTTP_INTERNAL_SERVER_ERROR = 500
    
    // ========== 缓存相关 ==========
    
    /**
     * 缓存有效期（毫秒）- 1小时
     */
    const val CACHE_VALIDITY_DURATION = 60 * 60 * 1000L
    
    /**
     * 公告缓存有效期（毫秒）- 30分钟
     */
    const val ANNOUNCEMENT_CACHE_DURATION = 30 * 60 * 1000L
    
    /**
     * 工具列表缓存有效期（毫秒）- 15分钟
     */
    const val TOOLS_CACHE_DURATION = 15 * 60 * 1000L
    
    // ========== UI 相关 ==========
    
    /**
     * 列表项动画持续时间（毫秒）
     */
    const val ANIMATION_DURATION = 300L
    
    /**
     * 搜索防抖延迟（毫秒）
     */
    const val SEARCH_DEBOUNCE_DELAY = 500L
    
    /**
     * 下拉刷新延迟（毫秒）
     */
    const val REFRESH_DELAY = 1000L
    
    // ========== 错误消息 ==========
    
    /**
     * 网络连接错误
     */
    const val ERROR_NETWORK = "网络连接失败，请检查网络设置"
    
    /**
     * 服务器错误
     */
    const val ERROR_SERVER = "服务器错误，请稍后重试"
    
    /**
     * 数据解析错误
     */
    const val ERROR_PARSE = "数据解析失败"
    
    /**
     * 未知错误
     */
    const val ERROR_UNKNOWN = "未知错误，请稍后重试"
    
    /**
     * 请求头格式错误
     */
    const val ERROR_INVALID_HEADERS = "请求头格式不正确，请使用有效的JSON格式"
}