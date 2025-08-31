package cn.lemwood.zeapi

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import cn.lemwood.zeapi.data.SharedPreferencesManager

class SplashActivity : AppCompatActivity() {

    private lateinit var sharedPreferencesManager: SharedPreferencesManager
    private val splashDelay = 2000L // 2秒启动延迟

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // 隐藏状态栏和导航栏，实现全屏效果
        window.decorView.systemUiVisibility = (
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                        or android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )

        sharedPreferencesManager = SharedPreferencesManager(this)

        // 延迟跳转到主页面
        Handler(Looper.getMainLooper()).postDelayed({
            navigateToMain()
        }, splashDelay)
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish()
        
        // 添加过渡动画
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }

    override fun onBackPressed() {
        // 在启动页面禁用返回键
        // super.onBackPressed()
    }
}