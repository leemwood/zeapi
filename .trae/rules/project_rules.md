Android SDK 要求：安卓版本7.0及以上  
应用名称：zeapi  
包名：cn.lemwood.zeapi  
技术栈：Kotlin，Tailwind CSS  
不支持多语言  
GitHub用户：leemwood（仓库名：zeapi）  
作者昵称：柠枺  
联系邮箱：3436464181@qq.com  
使用限制：避免大量使用emoji，仅在必要时少量使用  

应用简介：  
本应用基于zeapi.ink提供的工具集合，通过调用其API实现多种实用工具功能。  

应用布局：  
1. 首页：  
   - 显示来自GitHub仓库的公告  
   - 推荐工具展示  

2. 工具集页面：  
   - 支持搜索功能  
   - 不使用标签分类  

3. 设置页面：  
   - 唯一设置项：请求头填写  
   - 数据持久化（退出应用不重置）  

相关链接：https://zeapi.ink

现在要求每个类创建单独的类，每个类只负责一个工具
在每个工具的请求添加来自设置页面的请求头

## 已实现的工具

### 舔狗日记工具
- **API地址**: https://zeapi.ink/v1/api/tgrj
- **请求方式**: GET
- **参数**: 无需参数
- **返回格式**: 纯文本
- **数据库**: 共收录3.9k条舔狗日记
- **工具类**: TianGouDiaryTool.kt
- **工具ID**: tiangou_diary
- **分类**: 娱乐
- **图标**: 💔
- **特点**: 直接返回纯文本，无需JSON解析
- **UI特性**: 无需参数输入，隐藏参数容器和下载按钮

### 历史上的今天工具
- **API地址**: https://zeapi.ink/v1/today.php
- **工具类**: TodayInHistoryTool.kt
- **工具ID**: today_in_history

### 随机一言工具
- **API地址**: https://zeapi.ink/v1/onesay.php
- **工具类**: RandomQuoteTool.kt
- **工具ID**: random_quote

### 二维码生成工具
- **API地址**: https://zeapi.ink/v1/qrcode.php
- **工具类**: QRCodeGeneratorTool.kt
- **工具ID**: qrcode_generator
- **特点**: 支持图片显示和下载功能

## 开发注意事项

1. **工具类结构**:
   - 继承BaseToolService
   - 实现execute方法用于统一调用
   - 添加具体功能方法
   - 支持请求头配置

2. **UI集成步骤**:
   - 在LocalToolService中注册工具
   - 在setupUI方法中添加UI设置
   - 在executeTool方法中添加执行逻辑
   - 在formatResult方法中添加格式化逻辑

3. **磁盘空间管理**:
   - gradle缓存位于E:\.gradle
   - 构建失败可能因磁盘空间不足
   - 需要定期清理缓存文件

4. **环境变量配置**:
   - **Android SDK路径**: E:\Android\Sdk
   - **Gradle缓存**: E:\.gradle
   - **Maven仓库**: E:\.m2\repository
   - **临时文件**: E:\temp
   - **配置文件**: gradle.properties
   
   **gradle.properties关键配置**:
   ```
   # Gradle缓存目录配置到E盘
   org.gradle.user.home=E:\\.gradle
   gradle.user.home=E:\\.gradle
   
   # Android SDK路径配置
   sdk.dir=E:\\Android\\Sdk
   ANDROID_HOME=E:\\Android\\Sdk
   ANDROID_SDK_HOME=E:\\Android\\Sdk
   
   # 临时文件目录配置到E盘
   java.io.tmpdir=E:\\temp
   
   # Maven仓库配置到E盘
   maven.repo.local=E:\\.m2\\repository
   
   # Gradle守护进程配置
   org.gradle.daemon=true
   org.gradle.configureondemand=true
   org.gradle.caching=true
   org.gradle.parallel=true
   ```
   
   **注意事项**:
   - 所有下载和缓存都配置到E盘，避免占用C盘空间
   - 需要手动创建相关目录结构
   - 配置后需要重启Gradle守护进程