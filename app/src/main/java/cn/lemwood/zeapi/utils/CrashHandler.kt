package cn.lemwood.zeapi.utils

import android.content.Context
import android.os.Build
import android.util.Log
import cn.lemwood.zeapi.ui.crash.CrashActivity
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.*

class CrashHandler private constructor() : Thread.UncaughtExceptionHandler {
    
    private var context: Context? = null
    private var defaultHandler: Thread.UncaughtExceptionHandler? = null
    
    companion object {
        private const val TAG = "CrashHandler"
        
        @Volatile
        private var instance: CrashHandler? = null
        
        fun getInstance(): CrashHandler {
            return instance ?: synchronized(this) {
                instance ?: CrashHandler().also { instance = it }
            }
        }
    }
    
    fun init(context: Context) {
        this.context = context.applicationContext
        defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler(this)
    }
    
    override fun uncaughtException(thread: Thread, ex: Throwable) {
        Log.e(TAG, "Uncaught exception in thread ${thread.name}", ex)
        
        if (!handleException(ex) && defaultHandler != null) {
            // 如果用户没有处理则让系统默认的异常处理器来处理
            defaultHandler?.uncaughtException(thread, ex)
        } else {
            try {
                Thread.sleep(3000)
            } catch (e: InterruptedException) {
                Log.e(TAG, "Error : ", e)
            }
            
            // 退出程序
            android.os.Process.killProcess(android.os.Process.myPid())
            System.exit(1)
        }
    }
    
    private fun handleException(ex: Throwable?): Boolean {
        if (ex == null) {
            return false
        }
        
        val context = this.context ?: return false
        
        try {
            // 收集设备参数信息
            val crashInfo = collectCrashInfo(ex)
            
            // 启动崩溃处理Activity
            CrashActivity.start(context, crashInfo)
            
            return true
        } catch (e: Exception) {
            Log.e(TAG, "An error occurred while handling crash", e)
            return false
        }
    }
    
    private fun collectCrashInfo(ex: Throwable): String {
        val sb = StringBuilder()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        
        // 添加时间戳
        sb.append("崩溃时间: ${dateFormat.format(Date())}\n\n")
        
        // 添加设备信息
        sb.append("设备信息:\n")
        sb.append("品牌: ${Build.BRAND}\n")
        sb.append("型号: ${Build.MODEL}\n")
        sb.append("系统版本: Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\n")
        sb.append("CPU架构: ${Build.CPU_ABI}\n")
        sb.append("制造商: ${Build.MANUFACTURER}\n\n")
        
        // 添加应用信息
        context?.let { ctx ->
            try {
                val packageInfo = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
                sb.append("应用信息:\n")
                sb.append("包名: ${packageInfo.packageName}\n")
                sb.append("版本名: ${packageInfo.versionName}\n")
                sb.append("版本号: ${packageInfo.versionCode}\n\n")
            } catch (e: Exception) {
                sb.append("应用信息: 获取失败\n\n")
            }
        }
        
        // 添加异常信息
        sb.append("异常信息:\n")
        sb.append("异常类型: ${ex.javaClass.name}\n")
        sb.append("异常消息: ${ex.message ?: "无消息"}\n\n")
        
        // 添加堆栈跟踪
        sb.append("堆栈跟踪:\n")
        val sw = StringWriter()
        val pw = PrintWriter(sw)
        ex.printStackTrace(pw)
        sb.append(sw.toString())
        
        // 添加Caused by信息
        var cause = ex.cause
        while (cause != null) {
            sb.append("\nCaused by: ${cause.javaClass.name}: ${cause.message ?: "无消息"}\n")
            val causeSw = StringWriter()
            val causePw = PrintWriter(causeSw)
            cause.printStackTrace(causePw)
            sb.append(causeSw.toString())
            cause = cause.cause
        }
        
        return sb.toString()
    }
}