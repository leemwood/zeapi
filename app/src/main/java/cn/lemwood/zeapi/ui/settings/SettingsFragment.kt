package cn.lemwood.zeapi.ui.settings

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import cn.lemwood.zeapi.databinding.FragmentSettingsBinding

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var settingsViewModel: SettingsViewModel

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        settingsViewModel = ViewModelProvider(this)[SettingsViewModel::class.java]
        
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        val root: View = binding.root
        
        setupViews()
        observeViewModel()
        setupClickListeners()
        
        // 加载保存的设置
        settingsViewModel.loadSettings()
        
        return root
    }
    
    private fun setupViews() {
        // 设置版本信息
        try {
            val packageInfo = requireContext().packageManager.getPackageInfo(requireContext().packageName, 0)
            binding.textViewVersion.text = packageInfo.versionName
        } catch (e: Exception) {
            binding.textViewVersion.text = "1.0.0"
        }
    }
    
    private fun setupClickListeners() {
        // 保存按钮
        binding.buttonSave.setOnClickListener {
            saveSettings()
        }
        
        // 重置按钮
        binding.buttonReset.setOnClickListener {
            resetSettings()
        }
        
        // GitHub 链接
        binding.layoutGitHub.setOnClickListener {
            openUrl("https://github.com/leemwood/zeapi")
        }
        
        // 邮箱联系
        binding.layoutEmail.setOnClickListener {
            sendEmail("3436464181@qq.com")
        }
    }
    
    private fun observeViewModel() {
        // 观察设置数据
        settingsViewModel.userAgent.observe(viewLifecycleOwner) { userAgent ->
            if (binding.editTextUserAgent.text.toString() != userAgent) {
                binding.editTextUserAgent.setText(userAgent)
            }
        }
        
        settingsViewModel.authorization.observe(viewLifecycleOwner) { authorization ->
            if (binding.editTextAuthorization.text.toString() != authorization) {
                binding.editTextAuthorization.setText(authorization)
            }
        }
        
        settingsViewModel.customHeaders.observe(viewLifecycleOwner) { customHeaders ->
            if (binding.editTextCustomHeaders.text.toString() != customHeaders) {
                binding.editTextCustomHeaders.setText(customHeaders)
            }
        }
        
        // 观察保存状态
        settingsViewModel.saveResult.observe(viewLifecycleOwner) { result ->
            result?.let {
                if (it.isSuccess) {
                    Toast.makeText(context, "设置保存成功", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "保存失败: ${it.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    
    private fun saveSettings() {
        val userAgent = binding.editTextUserAgent.text.toString().trim()
        val authorization = binding.editTextAuthorization.text.toString().trim()
        val customHeaders = binding.editTextCustomHeaders.text.toString().trim()
        
        // 验证自定义请求头格式
        if (customHeaders.isNotEmpty() && !settingsViewModel.isValidJson(customHeaders)) {
            Toast.makeText(context, "自定义请求头格式不正确，请使用有效的JSON格式", Toast.LENGTH_LONG).show()
            return
        }
        
        settingsViewModel.saveSettings(userAgent, authorization, customHeaders)
    }
    
    private fun resetSettings() {
        settingsViewModel.resetSettings()
        Toast.makeText(context, "设置已重置", Toast.LENGTH_SHORT).show()
    }
    
    private fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "无法打开链接", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun sendEmail(email: String) {
        try {
            val intent = Intent(Intent.ACTION_SENDTO).apply {
                data = Uri.parse("mailto:$email")
                putExtra(Intent.EXTRA_SUBJECT, "zeapi应用反馈")
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "无法打开邮件应用", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}