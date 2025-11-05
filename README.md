# HelloAgentsTS

轻量级 TypeScript LLM Agent 框架，提供了一套简洁的抽象层用于构建基于大语言模型的智能 Agent。本项目是 HelloAgents 的 TypeScript 重写版本，专注于提供类型安全和现代化的开发体验。

## 主要特点

- 💡 完整的 TypeScript 类型支持
- 🔌 支持所有 OpenAI 兼容服务（API 端点）
- 🧩 模块化设计，易于扩展
- 🔄 内置多轮对话支持
- 📦 零外部依赖（仅需 OpenAI SDK）
- 🛠️ 简洁的抽象接口

这是 HelloAgents 的 TypeScript 版本仓库（HelloAgentsTS）。项目目标是提供一套轻量的 LLM 客户端与 Agent 基类，便于在 TypeScript/Node 环境中调用 OpenAI 兼容的服务并构建多轮对话 Agent。

快速概览
- 语言：TypeScript (Node.js)
- 包管理：pnpm / npm
- 主要模块位置：`src/core`

已实现的核心文件（示例）
- `src/core/llm.ts` — HelloAgentsLLM：封装 OpenAI 兼容客户端、provider 自动检测、凭证解析与流式/非流式调用。
- `src/core/message.ts` — Message：消息类（role、content、timestamp、metadata）。
- `src/core/config.ts` — Config：配置管理（默认值与 `fromEnv()` 方法）。
- `src/core/agent.ts` — Agent：Agent 抽象基类（历史管理、抽象 `run` 方法）。

## 快速开始

### 1. 环境准备

```powershell
# 安装依赖
pnpm install

# 配置环境变量（PowerShell）
$env:LLM_API_KEY = "你的 API Key"
$env:LLM_BASE_URL = "https://你的服务地址"  # 可选，默认使用 OpenAI
$env:LLM_MODEL = "gpt-3.5-turbo"       # 可选，默认使用 gpt-3.5-turbo

# 运行类型检查
npx -y tsc --noEmit
```

### 2. 基础用法

```ts
import Config from './src/core/config.js';
import { Message } from './src/core/message.js';
import { HelloAgentsLLM } from './src/core/llm.js';

// 从环境变量加载配置
const cfg = Config.fromEnv();
const llm = new HelloAgentsLLM({ 
  apiKey: cfg.apiKey,
  baseUrl: cfg.baseUrl,
  model: cfg.model 
});

// 发送单轮消息
const msg = new Message('你好', 'user');
const response = await llm.invoke([msg]);
console.log(response.content);

// 流式输出
for await (const chunk of llm.think([msg])) {
  process.stdout.write(chunk);
}
```

### 3. 创建自定义 Agent

```ts
import { Agent } from './src/core/agent.js';
import { Message } from './src/core/message.js';
import { HelloAgentsLLM } from './src/core/llm.js';
import Config from './src/core/config.js';

class MathAgent extends Agent {
  constructor() {
    const cfg = Config.fromEnv();
    const llm = new HelloAgentsLLM({ 
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.model 
    });
    super(llm);
  }

  // 实现抽象的 run 方法
  async run(input: string): Promise<string> {
    // 构建系统提示词
    const systemMsg = new Message(
      '你是一个数学助手，帮助用户解决数学问题。',
      'system'
    );

    // 添加用户输入
    const userMsg = new Message(input, 'user');

    // 调用 LLM 并返回结果
    const response = await this.llm.invoke([systemMsg, userMsg]);
    return response.content;
  }
}

// 使用示例
const agent = new MathAgent();
const result = await agent.run('请计算 23 * 45');
console.log(result);
```

## 开发指南

### 类型检查

本项目使用 TypeScript 严格模式，建议在开发时经常运行类型检查：

```bash
npx -y tsc --noEmit
```

### 环境配置

核心配置项（均可选）：

```bash
LLM_API_KEY=sk-xxxxx        # API密钥
LLM_BASE_URL=https://xxx    # API端点
LLM_MODEL=gpt-3.5-turbo    # 模型名称
LLM_TEMPERATURE=0.7         # 采样温度
```

项目结构（重点）
```
.
├── src
│   └── core                      # 核心框架层
│       ├── agent.ts              # Agent基类
│       ├── llm.ts                # HelloAgentsLLM统一接口
│       ├── message.ts            # 消息系统
│       └── config.ts             # 配置管理
├── package.json
├── tsconfig.json
└── README.md
```

后续建议
- 如果你要把项目发布为 npm 包，建议补充 `package.json` 的入口、类型声明与打包脚本。
- 想要更严格的 SDK 类型对齐（避免在调用处做 cast），可以把项目的 `openai` 版本固定并直接使用 SDK 导出的类型。

## 贡献指南

欢迎通过以下方式贡献项目：

1. 提交 Issue
   - 报告 bug
   - 提出新功能建议
   - 改进文档

2. 提交 Pull Request
   - Fork 项目并创建特性分支
   - 确保代码符合项目风格
   - 运行 `npx -y tsc --noEmit` 确保类型检查通过
   - 提交 PR 并描述改动

## 协议

MIT License
