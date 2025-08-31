package cn.lemwood.zeapi.ui.tools

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import cn.lemwood.zeapi.databinding.FragmentToolsBinding
import cn.lemwood.zeapi.ui.home.adapter.ToolAdapter
import cn.lemwood.zeapi.ui.LocalToolDetailActivity

class ToolsFragment : Fragment() {

    private var _binding: FragmentToolsBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var toolsViewModel: ToolsViewModel
    private lateinit var toolAdapter: ToolAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        toolsViewModel = ViewModelProvider(this)[ToolsViewModel::class.java]
        
        _binding = FragmentToolsBinding.inflate(inflater, container, false)
        val root: View = binding.root
        
        setupRecyclerView()
        setupSearchView()
        setupSwipeRefresh()
        observeViewModel()
        setupClickListeners()
        
        // 加载数据
        toolsViewModel.loadTools()
        
        return root
    }
    
    private fun setupRecyclerView() {
        toolAdapter = ToolAdapter { tool ->
            // 跳转到本地工具详情页面
            val intent = android.content.Intent(requireContext(), LocalToolDetailActivity::class.java).apply {
                 putExtra(LocalToolDetailActivity.EXTRA_TOOL_ID, tool.id)
            }
            startActivity(intent)
        }
        binding.rvTools.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = toolAdapter
        }
    }
    
    private fun setupSearchView() {
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                toolsViewModel.searchTools(s.toString())
            }
            
            override fun afterTextChanged(s: Editable?) {}
        })
    }
    
    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.setOnRefreshListener {
            toolsViewModel.refreshTools()
        }
    }
    
    private fun setupClickListeners() {
        binding.btnRetry.setOnClickListener {
            toolsViewModel.loadTools()
        }
    }
    
    private fun observeViewModel() {
        // 观察工具列表
        toolsViewModel.tools.observe(viewLifecycleOwner) { tools ->
            toolAdapter.submitList(tools)
            updateViewState()
        }
        
        // 观察加载状态
        toolsViewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.swipeRefreshLayout.isRefreshing = isLoading
            updateViewState()
        }
        
        // 观察错误状态
        toolsViewModel.error.observe(viewLifecycleOwner) { error ->
            binding.tvErrorMessage.text = error
            updateViewState()
        }
        
        // 观察搜索结果
        toolsViewModel.filteredTools.observe(viewLifecycleOwner) { filteredTools ->
            toolAdapter.submitList(filteredTools)
            updateViewState()
        }
    }
    
    private fun updateViewState() {
        val isLoading = toolsViewModel.isLoading.value == true
        val error = toolsViewModel.error.value
        val tools = toolsViewModel.filteredTools.value ?: toolsViewModel.tools.value
        val isEmpty = tools.isNullOrEmpty()
        
        binding.apply {
            layoutLoading.visibility = if (isLoading && tools.isNullOrEmpty()) View.VISIBLE else View.GONE
            layoutErrorState.visibility = if (error != null && !isLoading) View.VISIBLE else View.GONE
            layoutEmptyState.visibility = if (isEmpty && !isLoading && error == null) View.VISIBLE else View.GONE
            swipeRefreshLayout.visibility = if (!isLoading || !tools.isNullOrEmpty()) View.VISIBLE else View.GONE
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
