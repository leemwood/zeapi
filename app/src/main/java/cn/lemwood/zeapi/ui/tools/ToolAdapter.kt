package cn.lemwood.zeapi.ui.tools

import android.content.Context
import android.content.Intent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import cn.lemwood.zeapi.R
import cn.lemwood.zeapi.ToolDetailActivity
import cn.lemwood.zeapi.data.model.Tool

class ToolAdapter(
    private val context: Context,
    private var tools: List<Tool> = emptyList(),
    private val onToolClick: ((Tool) -> Unit)? = null
) : RecyclerView.Adapter<ToolAdapter.ToolViewHolder>() {

    fun updateTools(newTools: List<Tool>) {
        tools = newTools
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ToolViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_tool, parent, false)
        return ToolViewHolder(view)
    }

    override fun onBindViewHolder(holder: ToolViewHolder, position: Int) {
        val tool = tools[position]
        holder.bind(tool)
    }

    override fun getItemCount(): Int = tools.size

    inner class ToolViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvToolName: TextView = itemView.findViewById(R.id.textViewToolName)
        private val tvToolDescription: TextView = itemView.findViewById(R.id.textViewToolDescription)
        private val tvToolCategory: TextView = itemView.findViewById(R.id.textViewToolCategory)
        private val ivRecommended: ImageView = itemView.findViewById(R.id.imageViewRecommended)

        fun bind(tool: Tool) {
            tvToolName.text = tool.name
            tvToolDescription.text = tool.description
            tvToolCategory.text = tool.category
            
            // 显示推荐标识
            ivRecommended.visibility = if (tool.isRecommended) {
                View.VISIBLE
            } else {
                View.GONE
            }

            // 设置点击事件
            itemView.setOnClickListener {
                // 优先使用传入的点击回调
                if (onToolClick != null) {
                    onToolClick.invoke(tool)
                } else {
                    // 默认跳转到工具详情页面
                    openToolDetail(tool)
                }
            }
            
            // 设置长按事件（可选）
            itemView.setOnLongClickListener {
                // 可以添加长按菜单，如收藏、分享等
                showToolOptions(tool)
                true
            }
        }
        
        private fun openToolDetail(tool: Tool) {
            val intent = Intent(context, ToolDetailActivity::class.java).apply {
                putExtra(ToolDetailActivity.EXTRA_TOOL_ID, tool.id)
                putExtra(ToolDetailActivity.EXTRA_TOOL_URL, tool.url)
            }
            context.startActivity(intent)
        }
        
        private fun showToolOptions(tool: Tool) {
            // TODO: 实现长按菜单功能
            // 可以显示收藏、分享、复制链接等选项
        }
    }
}