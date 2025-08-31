package cn.lemwood.zeapi.ui.home.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.lemwood.zeapi.data.model.Tool
import cn.lemwood.zeapi.databinding.ItemToolBinding

class ToolAdapter(
    private val onToolClick: (Tool) -> Unit
) : ListAdapter<Tool, ToolAdapter.ToolViewHolder>(
    ToolDiffCallback()
) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ToolViewHolder {
        val binding = ItemToolBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ToolViewHolder(binding, onToolClick)
    }

    override fun onBindViewHolder(holder: ToolViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ToolViewHolder(
        private val binding: ItemToolBinding,
        private val onToolClick: (Tool) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(tool: Tool) {
            binding.apply {
                textViewToolName.text = tool.name
                textViewToolDescription.text = tool.description
                textViewToolCategory.text = tool.category
                
                // 显示推荐标识
                imageViewRecommended.visibility = if (tool.isRecommended) {
                    View.VISIBLE
                } else {
                    View.GONE
                }
                
                // 设置点击事件
                root.setOnClickListener {
                    onToolClick(tool)
                }
                
                // TODO: 如果有工具图标URL，可以使用图片加载库加载
                // 目前使用默认图标
            }
        }
    }

    private class ToolDiffCallback : DiffUtil.ItemCallback<Tool>() {
        override fun areItemsTheSame(oldItem: Tool, newItem: Tool): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Tool, newItem: Tool): Boolean {
            return oldItem == newItem
        }
    }
}
