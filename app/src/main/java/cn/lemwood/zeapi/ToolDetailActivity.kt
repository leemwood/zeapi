package cn.lemwood.zeapi

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.MenuItem
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.ui.tooldetail.ToolDetailViewModel
import cn.lemwood.zeapi.databinding.ActivityToolDetailBinding

class ToolDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityToolDetailBinding
    private lateinit var viewModel: ToolDetailViewModel
    private var currentTool: Tool? = null

    companion object {
        const val EXTRA_TOOL_ID = "tool_id"
        const val EXTRA_TOOL_URL = "tool_url"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityToolDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupViewModel()
        setupClickListeners()
        loadToolDetails()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.apply {
            setDisplayHomeAsUpEnabled(true)
            setDisplayShowHomeEnabled(true)
            title = "工具详情"
        }
    }

    private fun setupViewModel() {
        viewModel = ViewModelProvider(this)[ToolDetailViewModel::class.java]
        
        viewModel.tool.observe(this) { tool ->
            tool?.let {
                currentTool = it
                displayToolInfo(it)
            }
        }
        
        viewModel.toolDetails.observe(this) { details ->
            binding.tvToolDetails.text = details ?: "暂无详细信息"
        }
        
        viewModel.isLoading.observe(this) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        }
        
        viewModel.error.observe(this) { error ->
            error?.let {
                Toast.makeText(this, it, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupClickListeners() {
        binding.btnOpenTool.setOnClickListener {
            currentTool?.let { tool ->
                openToolInBrowser(tool.url)
            }
        }
        
        binding.btnShareTool.setOnClickListener {
            currentTool?.let { tool ->
                shareToolInfo(tool)
            }
        }
    }

    private fun loadToolDetails() {
        val toolId = intent.getStringExtra(EXTRA_TOOL_ID)
        val toolUrl = intent.getStringExtra(EXTRA_TOOL_URL)
        
        if (toolId != null) {
            viewModel.loadToolDetails(toolId)
        } else if (toolUrl != null) {
            viewModel.loadToolDetailsByUrl(toolUrl)
        } else {
            Toast.makeText(this, "无效的工具信息", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun displayToolInfo(tool: Tool) {
        binding.tvToolName.text = tool.name
        binding.tvToolCategory.text = tool.category
        binding.tvToolDescription.text = tool.description
        
        supportActionBar?.title = tool.name
    }

    private fun openToolInBrowser(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "无法打开链接", Toast.LENGTH_SHORT).show()
        }
    }

    private fun shareToolInfo(tool: Tool) {
        val shareText = "推荐一个实用工具：${tool.name}\n${tool.description}\n链接：${tool.url}"
        val shareIntent = Intent().apply {
            action = Intent.ACTION_SEND
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
        }
        startActivity(Intent.createChooser(shareIntent, "分享工具"))
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                onBackPressed()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}