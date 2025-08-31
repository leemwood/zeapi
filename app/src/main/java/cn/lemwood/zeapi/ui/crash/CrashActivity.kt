package cn.lemwood.zeapi.ui.crash

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import cn.lemwood.zeapi.MainActivity
import cn.lemwood.zeapi.databinding.ActivityCrashBinding
import kotlin.system.exitProcess

class CrashActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityCrashBinding
    private var crashLog: String = ""
    
    companion object {
        const val EXTRA_CRASH_LOG = "crash_log"
        
        fun start(context: Context, crashLog: String) {
            val intent = Intent(context, CrashActivity::class.java).apply {
                putExtra(EXTRA_CRASH_LOG, crashLog)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            context.startActivity(intent)
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCrashBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // 获取崩溃日志
        crashLog = intent.getStringExtra(EXTRA_CRASH_LOG) ?: "未知错误"
        
        setupViews()
        setupClickListeners()
    }
    
    private fun setupViews() {
        // 显示崩溃日志
        binding.tvCrashLog.text = crashLog
        
        // 设置标题
        binding.tvTitle.text = "应用崩溃"
        binding.tvSubtitle.text = "很抱歉，应用遇到了意外错误"
    }
    
    private fun setupClickListeners() {
        // 复制日志按钮
        binding.btnCopyLog.setOnClickListener {
            copyLogToClipboard()
        }
        
        // 重启应用按钮
        binding.btnRestart.setOnClickListener {
            restartApp()
        }
        
        // 退出应用按钮
        binding.btnExit.setOnClickListener {
            exitApp()
        }
    }
    
    private fun copyLogToClipboard() {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("崩溃日志", crashLog)
        clipboard.setPrimaryClip(clip)
        
        Toast.makeText(this, "崩溃日志已复制到剪贴板", Toast.LENGTH_SHORT).show()
    }
    
    private fun restartApp() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }
    
    private fun exitApp() {
        finish()
        exitProcess(0)
    }
    
    override fun onBackPressed() {
        // 禁用返回键，防止用户返回到崩溃的界面
        super.onBackPressed()
    }
}