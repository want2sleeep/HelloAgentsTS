# Travel Assistant

Travel Assistant 是一个帮助用户规划和管理旅行的Python应用程序。

## 功能特点

- 旅行行程规划
- 目的地信息查询
- 预算管理
- 行程提醒

## 依赖要求

- Python 3.7+
- uv (推荐的Python包管理工具)

## 核心依赖

- requests: HTTP客户端，用于获取天气信息
- openai: OpenAI API客户端，用于AI对话功能
- tavily: Tavily API客户端，用于景点搜索

## 环境变量配置

使用前需要配置以下环境变量：

```bash
# ModelScope API密钥（必需）
MODELSCOPE_API_KEY=your_modelscope_key

# Tavily API密钥（必需，用于景点搜索）
TAVILY_API_KEY=your_tavily_key
```

您可以通过以下方式设置环境变量：

Windows PowerShell:
```powershell
$env:MODELSCOPE_API_KEY="your_key"
$env:TAVILY_API_KEY="your_key"
```

Linux/macOS:
```bash
export MODELSCOPE_API_KEY="your_key"
export TAVILY_API_KEY="your_key"
```

## 安装说明

1. 确保已安装 Python 3.7 或更高版本
2. 安装 uv（推荐）：
```bash
pip install uv
```

3. 克隆此仓库：
```bash
git clone https://github.com/yourusername/TravelAssistant.git
cd TravelAssistant
```

4. 使用 uv 安装依赖：
```bash
uv pip install -e .
```

也可以使用传统的pip安装：
```bash
pip install -e .
```

## 使用方法

运行主程序：
```bash
python main.py
```

## 项目结构

```
.
├── main.py              # 程序入口
├── pyproject.toml       # 项目配置文件
└── build/              # 构建文件目录
```

## 贡献指南

欢迎提交问题和合并请求来帮助改进项目。

## 许可证

本项目采用 MIT 许可证 - 详见 LICENSE 文件

## 联系方式

如有任何问题或建议，请通过以下方式联系：
- 提交 Issue
