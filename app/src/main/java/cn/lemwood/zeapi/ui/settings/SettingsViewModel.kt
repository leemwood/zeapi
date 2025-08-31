package cn.lemwood.zeapi.ui.settings

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import cn.lemwood.zeapi.data.SharedPreferencesManager
import kotlinx.coroutines.launch
import org.json.JSONObject

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val sharedPreferencesManager = SharedPreferencesManager(application)
    
    private val _userAgent = MutableLiveData<String>()
    val userAgent: LiveData<String> = _userAgent
    
    private val _authorization = MutableLiveData<String>()
    val authorization: LiveData<String> = _authorization
    
    private val _customHeaders = MutableLiveData<String>()
    val customHeaders: LiveData<String> = _customHeaders
    
    private val _saveResult = MutableLiveData<Result<Unit>?>()
    val saveResult: LiveData<Result<Unit>?> = _saveResult
    
    fun loadSettings() {
        viewModelScope.launch {
            _userAgent.value = sharedPreferencesManager.getUserAgent()
            _authorization.value = sharedPreferencesManager.getAuthorization()
            _customHeaders.value = sharedPreferencesManager.getCustomHeaders()
        }
    }
    
    fun saveSettings(userAgent: String, authorization: String, customHeaders: String) {
        viewModelScope.launch {
            try {
                sharedPreferencesManager.saveUserAgent(userAgent)
                sharedPreferencesManager.saveAuthorization(authorization)
                sharedPreferencesManager.saveCustomHeaders(customHeaders)
                
                _userAgent.value = userAgent
                _authorization.value = authorization
                _customHeaders.value = customHeaders
                
                _saveResult.value = Result.success(Unit)
            } catch (e: Exception) {
                _saveResult.value = Result.failure(e)
            }
        }
    }
    
    fun resetSettings() {
        viewModelScope.launch {
            sharedPreferencesManager.clearAllSettings()
            _userAgent.value = ""
            _authorization.value = ""
            _customHeaders.value = ""
        }
    }
    
    fun isValidJson(jsonString: String): Boolean {
        if (jsonString.isEmpty()) return true
        
        return try {
            JSONObject(jsonString)
            true
        } catch (e: Exception) {
            false
        }
    }
    
    // 获取当前设置用于网络请求
    fun getCurrentHeaders(): Map<String, String> {
        val headers = mutableMapOf<String, String>()
        
        // 添加 User-Agent
        val userAgentValue = _userAgent.value
        if (!userAgentValue.isNullOrEmpty()) {
            headers["User-Agent"] = userAgentValue
        }
        
        // 添加 Authorization
        val authorizationValue = _authorization.value
        if (!authorizationValue.isNullOrEmpty()) {
            headers["Authorization"] = authorizationValue
        }
        
        // 添加自定义请求头
        val customHeadersValue = _customHeaders.value
        if (!customHeadersValue.isNullOrEmpty() && isValidJson(customHeadersValue)) {
            try {
                val jsonObject = JSONObject(customHeadersValue)
                val keys = jsonObject.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val value = jsonObject.getString(key)
                    headers[key] = value
                }
            } catch (e: Exception) {
                // 忽略解析错误
            }
        }
        
        return headers
    }
}