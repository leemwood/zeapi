package cn.lemwood.zeapi

import android.app.Application
import cn.lemwood.zeapi.utils.CrashHandler

class ZeApiApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // 初始化崩溃处理器
        CrashHandler.getInstance().init(this)
    }
}