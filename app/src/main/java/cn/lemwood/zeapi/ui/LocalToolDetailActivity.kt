package cn.lemwood.zeapi.ui

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ContentValues
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.lemwood.zeapi.R
import cn.lemwood.zeapi.databinding.ActivityLocalToolDetailBinding
import cn.lemwood.zeapi.service.LocalToolService
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.*

class LocalToolDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLocalToolDetailBinding
    private lateinit var localToolService: LocalToolService
    private var toolId: String = ""
    private var toolName: String = ""
    private var toolDescription: String = ""
    private var toolCategory: String = ""
    private var currentQRCodeData: String = "" // 存储当前生成的二维码Base64数据
    
    // 权限请求启动器
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            // 权限已授予，执行下载
            performDownload()
        } else {
            showPermissionDeniedDialog()
        }
    }

    companion object {
        const val EXTRA_TOOL_ID = "tool_id"
        const val EXTRA_TOOL_NAME = "tool_name"
        const val EXTRA_TOOL_DESCRIPTION = "tool_description"
        const val EXTRA_TOOL_CATEGORY = "tool_category"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLocalToolDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        localToolService = LocalToolService(this)

        // 获取传递的工具信息
        toolId = intent.getStringExtra(EXTRA_TOOL_ID) ?: ""
        toolName = intent.getStringExtra(EXTRA_TOOL_NAME) ?: ""
        toolDescription = intent.getStringExtra(EXTRA_TOOL_DESCRIPTION) ?: ""
        toolCategory = intent.getStringExtra(EXTRA_TOOL_CATEGORY) ?: ""

        setupUI()
        setupClickListeners()
    }

    private fun setupUI() {
        binding.toolTitle.text = toolName
        binding.toolCategory.text = if (toolCategory.isNotEmpty()) "分类：$toolCategory" else ""
        binding.toolDescription.text = toolDescription

        // 根据工具类型设置UI
        when (toolId) {
            "today_in_history" -> setupTodayInHistoryUI()
            "random_quote" -> setupRandomQuoteUI()
            "qrcode_generator" -> setupQRCodeGeneratorUI()
            else -> {
                binding.parameterContainer.visibility = View.GONE
            }
        }
    }

    private fun setupClickListeners() {
        binding.btnExecute.setOnClickListener {
            executeTool()
        }

        binding.btnCopy.setOnClickListener {
            copyResult()
        }

        binding.btnDownload.setOnClickListener {
            downloadQRCode()
        }

        binding.btnClear.setOnClickListener {
            clearResult()
        }
    }

    private fun setupTodayInHistoryUI() {
        binding.parameterContainer.visibility = View.VISIBLE
        binding.parameterTitle.text = "日期参数（可选）"
        binding.parameterDescription.text = "格式：MM-DD，如：09-01，留空则使用今天"
        
        // 隐藏下载按钮
        binding.btnDownload.visibility = View.GONE
        
        // 显示月份和日期输入框
        binding.monthInputLayout.visibility = View.VISIBLE
        binding.dayInputLayout.visibility = View.VISIBLE
        binding.monthInput.visibility = View.VISIBLE
        binding.dayInput.visibility = View.VISIBLE
        
        // 设置提示文本
        binding.monthInputLayout.hint = "月份"
        binding.dayInputLayout.hint = "日期"
        
        binding.monthInput.setText("") // 默认为空，使用今天
        binding.dayInput.setText("") // 默认为空，使用今天
    }

    private fun setupRandomQuoteUI() {
        // 随机一言不需要任何参数，隐藏整个参数容器
        binding.parameterContainer.visibility = View.GONE
        
        // 隐藏下载按钮
        binding.btnDownload.visibility = View.GONE
        
        // 隐藏月份和日期输入框
        binding.monthInputLayout.visibility = View.GONE
        binding.dayInputLayout.visibility = View.GONE
        binding.monthInput.visibility = View.GONE
        binding.dayInput.visibility = View.GONE
    }
    
    private fun setupQRCodeGeneratorUI() {
        binding.parameterContainer.visibility = View.VISIBLE
        binding.parameterTitle.text = "二维码参数"
        binding.parameterDescription.text = "输入要生成二维码的文本内容，可选择尺寸和格式"
        
        // 显示下载按钮
        binding.btnDownload.visibility = View.VISIBLE
        
        // 显示月份和日期输入框，但重新定义用途
        binding.monthInputLayout.visibility = View.VISIBLE
        binding.dayInputLayout.visibility = View.VISIBLE
        binding.monthInput.visibility = View.VISIBLE
        binding.dayInput.visibility = View.VISIBLE
        
        // 重新定义输入框用途
        binding.monthInputLayout.hint = "文本内容"
        binding.dayInputLayout.hint = "尺寸(像素)"
        
        binding.monthInput.setText("") // 文本内容
        binding.dayInput.setText("200") // 默认尺寸200px
    }

    private fun executeTool() {
        val monthParam = binding.monthInput.text.toString().trim()
        val dayParam = binding.dayInput.text.toString().trim()
        
        binding.btnExecute.isEnabled = false
        binding.progressBar.visibility = View.VISIBLE
        binding.resultContainer.visibility = View.VISIBLE
        binding.resultText.text = "正在执行..."

        lifecycleScope.launch {
            try {
                val result = when (toolId) {
                    "today_in_history" -> {
                        if (monthParam.isEmpty() || dayParam.isEmpty()) {
                            localToolService.getTodayInHistory()
                        } else {
                            val dateParam = String.format("%02d-%02d", monthParam.toIntOrNull() ?: 1, dayParam.toIntOrNull() ?: 1)
                            localToolService.getTodayInHistory(dateParam)
                        }
                    }
                    "random_quote" -> {
                        localToolService.getRandomQuote()
                    }
                    "qrcode_generator" -> {
                        val text = monthParam // 使用monthInput作为文本输入
                        val size = dayParam.toIntOrNull() ?: 200 // 使用dayInput作为尺寸输入
                        if (text.isEmpty()) {
                            "请输入要生成二维码的文本内容"
                        } else {
                            localToolService.generateQRCode(text, size, 4, "jpg")
                        }
                    }
                    else -> "不支持的工具类型"
                }
                
                // 格式化结果
                val formattedResult = formatResult(toolId, result)
                binding.resultText.text = formattedResult
                
            } catch (e: Exception) {
                binding.resultText.text = "执行失败：${e.message}"
            } finally {
                binding.btnExecute.isEnabled = true
                binding.progressBar.visibility = View.GONE
            }
        }
    }

    private fun formatResult(toolId: String, jsonResult: String): String {
        return try {
            when (toolId) {
                "today_in_history" -> formatTodayInHistoryResult(jsonResult)
                "random_quote" -> formatRandomQuoteResult(jsonResult)
                "qrcode_generator" -> formatQRCodeResult(jsonResult)
                else -> jsonResult
            }
        } catch (e: Exception) {
            "❌ 格式化失败：${e.message}\n\n原始数据：\n$jsonResult"
        }
    }

    private fun formatTodayInHistoryResult(jsonResult: String): String {
        return try {
            val jsonObject = JSONObject(jsonResult)
            val status = jsonObject.getString("status")
            
            if (status == "success") {
                val data = jsonObject.getJSONObject("data")
                val date = data.getString("date")
                val events = data.getJSONArray("events")
                val message = jsonObject.optString("message", "")
                
                val formatted = StringBuilder()
                formatted.append("📅 历史上的今天 - $date\n")
                if (message.isNotEmpty()) {
                    formatted.append("$message\n")
                }
                formatted.append("\n")
                
                for (i in 0 until events.length()) {
                    val event = events.getJSONObject(i)
                    val year = event.getInt("year")
                    val typeText = event.getString("typeText")
                    val eventData = event.getString("data")
                    
                    val icon = when (typeText) {
                        "出生" -> "👶"
                        "事件" -> "📜"
                        "逝世" -> "🕊️"
                        else -> "📌"
                    }
                    
                    formatted.append("$icon ${year}年 - $typeText\n")
                    formatted.append("   $eventData\n\n")
                }
                
                formatted.toString().trim()
            } else {
                val message = jsonObject.optString("message", "未知错误")
                "❌ 获取失败：$message"
            }
        } catch (e: Exception) {
            "❌ 数据解析失败：${e.message}\n\n原始数据：\n$jsonResult"
        }
    }

    private fun formatRandomQuoteResult(jsonResult: String): String {
        return try {
            // 随机一言API返回纯文本，不是JSON格式
            if (jsonResult.startsWith("请求失败") || jsonResult.startsWith("网络请求失败")) {
                "❌ $jsonResult"
            } else if (jsonResult == "获取一言失败") {
                "❌ $jsonResult"
            } else {
                "💭 随机一言\n\n$jsonResult"
            }
        } catch (e: Exception) {
            "❌ 格式化失败：${e.message}\n\n原始数据：\n$jsonResult"
        }
    }
    
    private fun formatQRCodeResult(jsonResult: String): String {
        return try {
            // 检查是否是错误信息
            if (jsonResult.startsWith("请求失败") || jsonResult.startsWith("网络请求失败") || jsonResult.startsWith("请输入要生成")) {
                "❌ $jsonResult"
            } else if (jsonResult == "生成二维码失败") {
                "❌ $jsonResult"
            } else {
                // 尝试解析JSON响应
                val jsonObject = JSONObject(jsonResult)
                val status = jsonObject.optString("status", "")
                
                if (status == "success") {
                    val data = jsonObject.optJSONObject("data")
                    if (data != null) {
                        val text = data.optString("text", "")
                        val size = data.optInt("size", 0)
                        val format = data.optString("format", "")
                        val imageData = data.optString("image", "")
                        
                        val result = StringBuilder()
                        result.append("📱 二维码生成成功\n\n")
                        result.append("文本内容：$text\n")
                        result.append("图片尺寸：${size}x${size}px\n")
                        result.append("图片格式：$format\n\n")
                        
                        if (imageData.isNotEmpty()) {
                            // 保存二维码数据供下载使用
                            currentQRCodeData = imageData
                            result.append("✅ 二维码已生成\n")
                            result.append("💡 提示：点击下载按钮保存图片到相册")
                        } else {
                            currentQRCodeData = ""
                            result.append("❌ 图片数据为空")
                        }
                        
                        result.toString()
                    } else {
                        "❌ 响应数据格式错误"
                    }
                } else {
                    val message = jsonObject.optString("message", "未知错误")
                    "❌ $message"
                }
            }
        } catch (e: Exception) {
            "❌ 格式化失败：${e.message}\n\n原始数据：\n$jsonResult"
        }
    }

    private fun copyResult() {
        val result = binding.resultText.text.toString()
        if (result.isNotEmpty() && result != "暂无结果") {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("工具结果", result)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "结果已复制到剪贴板", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "暂无可复制的结果", Toast.LENGTH_SHORT).show()
        }
    }

    private fun downloadQRCode() {
        if (currentQRCodeData.isEmpty()) {
            Toast.makeText(this, "没有可下载的二维码图片", Toast.LENGTH_SHORT).show()
            return
        }
        
        // 检查权限
        val requiredPermissions = getRequiredPermissions()
        val missingPermissions = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        
        if (missingPermissions.isNotEmpty()) {
            // 请求权限
            permissionLauncher.launch(missingPermissions.toTypedArray())
        } else {
            // 权限已授予，直接下载
            performDownload()
        }
    }
    
    private fun performDownload() {
        try {
            Log.d("LocalToolDetail", "开始下载二维码，数据长度: ${currentQRCodeData.length}")
            
            // 解码Base64数据
            val imageBytes = Base64.decode(currentQRCodeData, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            
            if (bitmap == null) {
                Log.e("LocalToolDetail", "图片数据解析失败")
                Toast.makeText(this, "图片数据解析失败", Toast.LENGTH_SHORT).show()
                return
            }
            
            Log.d("LocalToolDetail", "图片解析成功，尺寸: ${bitmap.width}x${bitmap.height}")
            
            // 生成文件名
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val fileName = "QRCode_$timeStamp.png"
            
            // 保存到相册
            val contentValues = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ZeAPI")
                    put(MediaStore.Images.Media.IS_PENDING, 1) // 标记为待处理状态
                }
            }
            
            Log.d("LocalToolDetail", "准备插入MediaStore，文件名: $fileName，Android版本: ${Build.VERSION.SDK_INT}")
            
            val uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
            
            if (uri != null) {
                Log.d("LocalToolDetail", "MediaStore URI创建成功: $uri")
                
                var success = false
                contentResolver.openOutputStream(uri)?.use { outputStream ->
                    success = bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
                    Log.d("LocalToolDetail", "图片压缩结果: $success")
                }
                
                if (success) {
                    // Android 10+ 需要清除IS_PENDING标记
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val updateValues = ContentValues().apply {
                            put(MediaStore.Images.Media.IS_PENDING, 0)
                        }
                        contentResolver.update(uri, updateValues, null, null)
                        Log.d("LocalToolDetail", "清除IS_PENDING标记")
                    }
                    
                    Toast.makeText(this, "二维码已保存到相册", Toast.LENGTH_SHORT).show()
                    Log.d("LocalToolDetail", "二维码保存成功")
                } else {
                    Log.e("LocalToolDetail", "图片压缩失败")
                    Toast.makeText(this, "保存失败：图片压缩失败", Toast.LENGTH_SHORT).show()
                    // 删除失败的文件
                    contentResolver.delete(uri, null, null)
                }
            } else {
                Log.e("LocalToolDetail", "MediaStore URI创建失败")
                Toast.makeText(this, "保存失败：无法创建文件", Toast.LENGTH_SHORT).show()
            }
            
        } catch (e: Exception) {
            Log.e("LocalToolDetail", "下载失败", e)
            Toast.makeText(this, "下载失败：${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun clearResult() {
        binding.resultText.text = "暂无结果"
        currentQRCodeData = "" // 清空二维码数据
        Toast.makeText(this, "结果已清空", Toast.LENGTH_SHORT).show()
    }
    
    private fun getRequiredPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ 使用新的媒体权限
            listOf(
                Manifest.permission.READ_MEDIA_IMAGES
            )
        } else {
            // Android 12 及以下使用传统存储权限
            listOf(
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE
            )
        }
    }
    
    private fun showPermissionDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("权限需要")
            .setMessage("为了保存二维码到相册，需要存储权限。请在设置中手动授予权限。")
            .setPositiveButton("确定") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }
}