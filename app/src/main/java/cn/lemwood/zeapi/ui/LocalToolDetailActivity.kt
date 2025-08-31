package cn.lemwood.zeapi.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import cn.lemwood.zeapi.R
import cn.lemwood.zeapi.databinding.ActivityLocalToolDetailBinding
import cn.lemwood.zeapi.service.LocalToolService
import kotlinx.coroutines.launch
import org.json.JSONObject

class LocalToolDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLocalToolDetailBinding
    private lateinit var localToolService: LocalToolService
    private var toolId: String = ""
    private var toolName: String = ""
    private var toolDescription: String = ""
    private var toolCategory: String = ""

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

        localToolService = LocalToolService()

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

        binding.btnClear.setOnClickListener {
            clearResult()
        }
    }

    private fun setupTodayInHistoryUI() {
        binding.parameterContainer.visibility = View.VISIBLE
        binding.parameterTitle.text = "日期参数（可选）"
        binding.parameterDescription.text = "格式：MM-DD，如：09-01，留空则使用今天"
        
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
        
        // 隐藏月份和日期输入框
        binding.monthInputLayout.visibility = View.GONE
        binding.dayInputLayout.visibility = View.GONE
        binding.monthInput.visibility = View.GONE
        binding.dayInput.visibility = View.GONE
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

    private fun clearResult() {
        binding.resultText.text = "暂无结果"
        Toast.makeText(this, "结果已清空", Toast.LENGTH_SHORT).show()
    }
}