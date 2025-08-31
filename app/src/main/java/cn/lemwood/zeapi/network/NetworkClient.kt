package cn.lemwood.zeapi.network

import cn.lemwood.zeapi.BuildConfig
import cn.lemwood.zeapi.data.Constants
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * 网络客户端管理类
 */
class NetworkClient {
    
    companion object {
        @Volatile
        private var INSTANCE: NetworkClient? = null
        
        fun getInstance(): NetworkClient {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: NetworkClient().also { INSTANCE = it }
            }
        }
    }
    
    private var customHeaders: Map<String, String> = emptyMap()
    
    /**
     * 更新自定义请求头
     */
    fun updateHeaders(headers: Map<String, String>) {
        customHeaders = headers
    }
    
    /**
     * 创建 OkHttpClient
     */
    private fun createOkHttpClient(): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
        
        // 添加日志拦截器（仅在调试模式下）
        if (BuildConfig.DEBUG) {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(loggingInterceptor)
        }
        
        // 添加自定义请求头拦截器
        builder.addInterceptor(createHeaderInterceptor())
        
        return builder.build()
    }
    
    /**
     * 创建请求头拦截器
     */
    private fun createHeaderInterceptor(): Interceptor {
        return Interceptor { chain ->
            val originalRequest = chain.request()
            val requestBuilder = originalRequest.newBuilder()
            
            // 添加默认请求头
            requestBuilder.addHeader("Accept", "application/json")
            requestBuilder.addHeader("Content-Type", "application/json")
            
            // 添加自定义请求头
            customHeaders.forEach { (key, value) ->
                requestBuilder.addHeader(key, value)
            }
            
            chain.proceed(requestBuilder.build())
        }
    }
    
    /**
     * 创建 zeapi.link API 服务
     */
    fun createZeApiService(): ApiService {
        val retrofit = Retrofit.Builder()
            .baseUrl(Constants.ZEAPI_BASE_URL)
            .client(createOkHttpClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        return retrofit.create(ApiService::class.java)
    }
    
    /**
     * 创建 GitHub API 服务
     */
    fun createGitHubApiService(): ApiService {
        val retrofit = Retrofit.Builder()
            .baseUrl(Constants.GITHUB_API_BASE_URL)
            .client(createOkHttpClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        return retrofit.create(ApiService::class.java)
    }
    
    /**
     * 创建备用 GitHub API 服务
     */
    fun createBackupGitHubApiService(): ApiService {
        val retrofit = Retrofit.Builder()
            .baseUrl(Constants.GITHUB_API_BACKUP_URL)
            .client(createOkHttpClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        return retrofit.create(ApiService::class.java)
    }
}