package cn.lemwood.zeapi.data.local

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import cn.lemwood.zeapi.data.SharedPreferencesManager
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class RandomAnimeImageTool(context: Context) : BaseToolService(context) {
    
    override val toolName: String = "random_anime_image"
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    companion object {
        private const val TAG = "RandomAnimeImageTool"
        private const val API_URL = "https://zeapi.ink/v1/api/sjecy"
    }
    
    /**
     * 获取随机二次元图片（默认格式，直接返回图片二进制数据）
     */
    suspend fun getRandomAnimeImage(): Result<Bitmap> {
        return try {
            val request = Request.Builder()
                .url(API_URL)
                .apply {
                    // 添加来自设置页面的请求头
                    addHeadersFromSettings()
                }
                .build()
            
            Log.d(TAG, "Requesting random anime image from: $API_URL")
            
            val response = client.newCall(request).execute()
            
            if (response.isSuccessful) {
                response.body?.byteStream()?.use { inputStream ->
                    val bitmap = BitmapFactory.decodeStream(inputStream)
                    if (bitmap != null) {
                        Log.d(TAG, "Successfully loaded anime image")
                        Result.success(bitmap)
                    } else {
                        Log.e(TAG, "Failed to decode image bitmap")
                        Result.failure(IOException("Failed to decode image"))
                    }
                } ?: Result.failure(IOException("Empty response body"))
            } else {
                Log.e(TAG, "HTTP error: ${response.code} - ${response.message}")
                Result.failure(IOException("HTTP ${response.code}: ${response.message}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting random anime image", e)
            Result.failure(e)
        }
    }
    
    /**
     * 获取随机二次元图片信息（JSON格式）
     */
    suspend fun getRandomAnimeImageInfo(): Result<AnimeImageInfo> {
        return try {
            val url = "$API_URL?format=json"
            val request = Request.Builder()
                .url(url)
                .apply {
                    // 添加来自设置页面的请求头
                    addHeadersFromSettings()
                }
                .build()
            
            Log.d(TAG, "Requesting random anime image info from: $url")
            
            val response = client.newCall(request).execute()
            
            if (response.isSuccessful) {
                response.body?.string()?.let { responseBody ->
                    Log.d(TAG, "Response body: $responseBody")
                    
                    val jsonObject = JSONObject(responseBody)
                    val status = jsonObject.getString("status")
                    
                    if (status == "success") {
                        val imageName = jsonObject.getString("image")
                        val imageUrl = jsonObject.getString("url")
                        
                        val info = AnimeImageInfo(
                            status = status,
                            imageName = imageName,
                            imageUrl = imageUrl
                        )
                        
                        Log.d(TAG, "Successfully got anime image info: $info")
                        Result.success(info)
                    } else {
                        val errorMessage = jsonObject.optString("error", "Unknown error")
                        Log.e(TAG, "API error: $errorMessage")
                        Result.failure(IOException("API error: $errorMessage"))
                    }
                } ?: Result.failure(IOException("Empty response body"))
            } else {
                Log.e(TAG, "HTTP error: ${response.code} - ${response.message}")
                Result.failure(IOException("HTTP ${response.code}: ${response.message}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting random anime image info", e)
            Result.failure(e)
        }
    }
    
    /**
     * 下载指定URL的图片
     */
    suspend fun downloadImage(imageUrl: String): Result<Bitmap> {
        return try {
            val request = Request.Builder()
                .url(imageUrl)
                .apply {
                    // 添加来自设置页面的请求头
                    addHeadersFromSettings()
                }
                .build()
            
            Log.d(TAG, "Downloading image from: $imageUrl")
            
            val response = client.newCall(request).execute()
            
            if (response.isSuccessful) {
                response.body?.byteStream()?.use { inputStream ->
                    val bitmap = BitmapFactory.decodeStream(inputStream)
                    if (bitmap != null) {
                        Log.d(TAG, "Successfully downloaded image")
                        Result.success(bitmap)
                    } else {
                        Log.e(TAG, "Failed to decode downloaded image")
                        Result.failure(IOException("Failed to decode image"))
                    }
                } ?: Result.failure(IOException("Empty response body"))
            } else {
                Log.e(TAG, "HTTP error during download: ${response.code} - ${response.message}")
                Result.failure(IOException("HTTP ${response.code}: ${response.message}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error downloading image", e)
            Result.failure(e)
        }
    }
    
    override suspend fun execute(params: Map<String, String>): Result<Any> {
        // 检查参数，如果指定了format=json，返回JSON信息，否则返回图片
        val format = params["format"] ?: "image"
        
        return if (format == "json") {
            getRandomAnimeImageInfo()
        } else {
            getRandomAnimeImage()
        }
    }
    
    private fun Request.Builder.addHeadersFromSettings(): Request.Builder {
        val sharedPrefs = SharedPreferencesManager(context)
        
        // 添加 User-Agent
        sharedPrefs.getUserAgent()?.let { userAgent ->
            addHeader("User-Agent", userAgent)
            Log.d(TAG, "Added User-Agent: $userAgent")
        }
        
        // 添加 Authorization
        sharedPrefs.getAuthorization()?.let { auth ->
            addHeader("Authorization", auth)
            Log.d(TAG, "Added Authorization header")
        }
        
        // 添加自定义请求头
        sharedPrefs.getCustomHeaders()?.let { customHeaders ->
            try {
                val jsonObject = JSONObject(customHeaders)
                jsonObject.keys().forEach { key ->
                    val value = jsonObject.getString(key)
                    addHeader(key, value)
                    Log.d(TAG, "Added custom header: $key")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing custom headers JSON", e)
            }
        }
        
        return this
    }
}

/**
 * 二次元图片信息数据类
 */
data class AnimeImageInfo(
    val status: String,
    val imageName: String,
    val imageUrl: String
)