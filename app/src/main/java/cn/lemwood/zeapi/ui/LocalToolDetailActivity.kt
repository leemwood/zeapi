package cn.lemwood.zeapi.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import cn.lemwood.zeapi.databinding.ActivityLocalToolDetailBinding
import cn.lemwood.zeapi.service.LocalToolService
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * 本地工具详情页面
 * 用于显示和执行本地硬编码的工具
 */
class LocalToolDetailActivity : AppCompatActivity() {
    
    companion object {
        const val EXTRA_TOOL_ID = "tool_id"
    }
    
    private lateinit var binding: ActivityLocalToolDetailBinding
    private lateinit var localToolService: LocalToolService
    private var toolId: String? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLocalToolDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        localToolService = LocalToolService()
        toolId = intent.getStringExtra(EXTRA_TOOL_ID)
        
        setupToolbar()
        setupUI()
        loadToolInfo()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun setupUI() {
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
    
    private fun loadToolInfo() {
        toolId?.let { id ->
            val tool = localToolService.getToolById(id)
            tool?.let {
                binding.toolTitle.text = it.name
                binding.toolDescription.text = it.description
                binding.toolCategory.text = "分类：${it.category}"
                
                // 根据工具类型显示不同的参数输入界面
                when (id) {
                    "today_in_history" -> setupTodayInHistoryUI()
                    "random_quote" -> setupRandomQuoteUI()
                }
            } ?: run {
                Toast.makeText(this, "工具不存在", Toast.LENGTH_SHORT).show()
                finish()
            }
        } ?: run {
            Toast.makeText(this, "缺少工具ID参数", Toast.LENGTH_SHORT).show()
            finish()
        }
    }
    
    private fun setupTodayInHistoryUI() {
        binding.parameterContainer.visibility = View.VISIBLE
        binding.parameterTitle.text = "参数设置（可选）"
        binding.parameterDescription.text = "可以指定查询的月份和日期，留空则查询今天"
        
        // 显示月份和日期输入框
        binding.monthInput.visibility = View.VISIBLE
        binding.dayInput.visibility = View.VISIBLE
        binding.monthInputLayout.hint = "月份 (1-12)"
        binding.dayInputLayout.hint = "日期 (1-31)"
        
        // 设置当前日期作为默认值
        val calendar = Calendar.getInstance()
        binding.monthInput.setText((calendar.get(Calendar.MONTH) + 1).toString())
        binding.dayInput.setText(calendar.get(Calendar.DAY_OF_MONTH).toString())
    }
    
    private fun setupRandomQuoteUI() {
        binding.parameterContainer.visibility = View.GONE
    }
    
    private fun executeTool() {
        toolId?.let { id ->
            binding.btnExecute.isEnabled = false
            binding.progressBar.visibility = View.VISIBLE
            binding.resultContainer.visibility = View.GONE
            
            lifecycleScope.launch {
                try {
                    val params = when (id) {
                        "today_in_history" -> {
                            val monthText = binding.monthInput.text.toString().trim()
                            val dayText = binding.dayInput.text.toString().trim()
                            
                            if (monthText.isNotEmpty() && dayText.isNotEmpty()) {
                                try {
                                    val month = monthText.toInt()
                                    val day = dayText.toInt()
                                    
                                    if (month in 1..12 && day in 1..31) {
                                        mapOf("month" to month, "day" to day)
                                    } else {
                                        Toast.makeText(this@LocalToolDetailActivity, "请输入有效的月份(1-12)和日期(1-31)", Toast.LENGTH_SHORT).show()
                                        return@launch
                                    }
                                } catch (e: NumberFormatException) {
                                    Toast.makeText(this@LocalToolDetailActivity, "请输入有效的数字", Toast.LENGTH_SHORT).show()
                                    return@launch
                                }
                            } else {
                                null
                            }
                        }
                        else -> null
                    }
                    
                    val result = localToolService.executeTool(id, params)
                    
                    binding.resultText.text = result
                    binding.resultContainer.visibility = View.VISIBLE
                    
                } catch (e: Exception) {
                    binding.resultText.text = "执行失败：${e.message}"
                    binding.resultContainer.visibility = View.VISIBLE
                } finally {
                    binding.progressBar.visibility = View.GONE
                    binding.btnExecute.isEnabled = true
                }
            }
        }
    }
    
    private fun copyResult() {
        val result = binding.resultText.text.toString()
        if (result.isNotEmpty()) {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("工具结果", result)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "结果已复制到剪贴板", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun clearResult() {
        binding.resultText.text = ""
        binding.resultContainer.visibility = View.GONE
    }
}