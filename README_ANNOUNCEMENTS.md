# ZeAPI 公告系统说明

## 概述

ZeAPI Android 应用现在支持从 GitHub 仓库的 JSON 文件中动态获取公告信息。这样可以在不更新应用的情况下，实时更新首页公告内容。

## 配置方法

### 1. 在 GitHub 仓库根目录创建 announcements.json 文件

在您的 GitHub 仓库（例如：`leemwood/zeapi`）根目录下创建一个名为 `announcements.json` 的文件。

### 2. JSON 文件格式

```json
{
  "announcements": [
    {
      "id": "unique_announcement_id",
      "title": "公告标题",
      "content": "公告内容详情",
      "date": "2025-01-01",
      "author": "柠枺",
      "isImportant": true
    },
    {
      "id": "another_announcement",
      "title": "另一个公告",
      "content": "这是另一个公告的内容",
      "date": "2025-01-15",
      "author": "柠枺",
      "isImportant": false
    }
  ]
}
```

### 3. 字段说明

- `id`: 公告的唯一标识符（字符串）
- `title`: 公告标题（字符串）
- `content`: 公告内容（字符串）
- `date`: 公告日期，格式为 YYYY-MM-DD（字符串）
- `author`: 公告作者，默认为"柠枺"（字符串）
- `isImportant`: 是否为重要公告，影响显示样式（布尔值）

## 工作原理

1. **优先级获取**：应用首先尝试从主 GitHub API (`api.github.com`) 获取仓库的 `announcements.json` 文件
2. **备用 API**：如果主 GitHub API 失败，自动切换到备用 GitHub API (`gayhub.lemwood.cn`) 重试获取公告
3. **降级方案**：如果两个 API 都失败或 JSON 文件不存在，应用会回退到从 GitHub Release 和 README 获取公告信息
4. **实时更新**：每次应用启动或刷新首页时，都会重新获取最新的公告信息

## 注意事项

- JSON 文件必须放在仓库根目录
- 文件名必须为 `announcements.json`
- JSON 格式必须正确，否则会使用备用方案
- 公告按照在数组中的顺序显示
- 建议定期更新公告内容以保持用户参与度

## 示例文件

项目根目录下的 `announcements.json` 文件提供了一个完整的示例，您可以参考该文件的格式来创建自己的公告内容。

## API 接口

应用通过以下 GitHub API 接口获取公告文件：

### 主 GitHub API
```
GET https://api.github.com/repos/leemwood/zeapi/contents/announcements.json
```

### 备用 GitHub API
```
GET https://gayhub.lemwood.cn/repos/leemwood/zeapi/contents/announcements.json
```

## 容错机制

- **自动重试**：主 API 失败时自动切换到备用 API
- **优雅降级**：所有 API 都失败时使用 GitHub Release 和 README 作为公告源
- **透明切换**：用户无感知的 API 切换，确保服务可用性

该接口返回的内容会被自动解码（如果是 Base64 编码）并解析为公告数据。