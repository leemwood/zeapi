package cn.lemwood.zeapi.ui.home

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import cn.lemwood.zeapi.ui.LocalToolDetailActivity
import cn.lemwood.zeapi.databinding.FragmentHomeBinding
import cn.lemwood.zeapi.ui.home.adapter.AnnouncementAdapter
import cn.lemwood.zeapi.ui.home.adapter.ToolAdapter

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    private lateinit var homeViewModel: HomeViewModel
    private lateinit var announcementAdapter: AnnouncementAdapter
    private lateinit var recommendedToolAdapter: ToolAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        homeViewModel = ViewModelProvider(this)[HomeViewModel::class.java]
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupRecyclerViews()
        setupObservers()
        setupRefreshLayout()
        
        // 加载数据
        homeViewModel.loadData()
    }

    private fun setupRecyclerViews() {
        // 设置公告列表
        announcementAdapter = AnnouncementAdapter()
        binding.rvAnnouncements.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = announcementAdapter
        }

        // 设置推荐工具列表
        recommendedToolAdapter = ToolAdapter { tool ->
            // 点击推荐工具时跳转到详情页面
            val intent = Intent(requireContext(), LocalToolDetailActivity::class.java).apply {
                putExtra(LocalToolDetailActivity.EXTRA_TOOL_ID, tool.id)
            }
            startActivity(intent)
        }
        binding.rvRecommendedTools.apply {
            layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
            adapter = recommendedToolAdapter
        }
    }

    private fun setupObservers() {
        // 观察公告数据
        homeViewModel.announcements.observe(viewLifecycleOwner) { announcements ->
            announcementAdapter.submitList(announcements)
            
            // 控制公告区域的可见性
            binding.layoutAnnouncements.visibility = if (announcements.isNotEmpty()) {
                View.VISIBLE
            } else {
                View.GONE
            }
        }

        // 观察推荐工具数据
        homeViewModel.recommendedTools.observe(viewLifecycleOwner) { tools ->
            recommendedToolAdapter.submitList(tools)
            
            // 控制推荐工具区域的可见性
            binding.layoutRecommendedTools.visibility = if (tools.isNotEmpty()) {
                View.VISIBLE
            } else {
                View.GONE
            }
        }

        // 观察加载状态
        homeViewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.swipeRefreshLayout.isRefreshing = isLoading
        }

        // 观察错误信息
        homeViewModel.error.observe(viewLifecycleOwner) { error ->
            error?.let {
                Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupRefreshLayout() {
        binding.swipeRefreshLayout.setOnRefreshListener {
            homeViewModel.refreshData()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}