package cn.lemwood.zeapi.ui.home.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.lemwood.zeapi.data.model.Announcement
import cn.lemwood.zeapi.databinding.ItemAnnouncementBinding

class AnnouncementAdapter : ListAdapter<Announcement, AnnouncementAdapter.AnnouncementViewHolder>(
    AnnouncementDiffCallback()
) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AnnouncementViewHolder {
        val binding = ItemAnnouncementBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AnnouncementViewHolder(binding)
    }

    override fun onBindViewHolder(holder: AnnouncementViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class AnnouncementViewHolder(private val binding: ItemAnnouncementBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(announcement: Announcement) {
            binding.apply {
                textViewAnnouncementTitle.text = announcement.title
                textViewAnnouncementContent.text = announcement.content
                textViewAnnouncementDate.text = announcement.date
                textViewAnnouncementAuthor.text = "- ${announcement.author}"
                
                // 如果是重要公告，可以设置不同的样式
                if (announcement.isImportant) {
                    textViewAnnouncementTitle.setTextColor(
                        itemView.context.getColor(android.R.color.holo_red_dark)
                    )
                }
            }
        }
    }

    private class AnnouncementDiffCallback : DiffUtil.ItemCallback<Announcement>() {
        override fun areItemsTheSame(oldItem: Announcement, newItem: Announcement): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Announcement, newItem: Announcement): Boolean {
            return oldItem == newItem
        }
    }
}
