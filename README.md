# HelloAgentsTS

轻量级 TypeScript LLM Agent 框架，提供了一套简洁的抽象层用于构建基于大语言模型的智能 Agent。本项目是 HelloAgents 的 TypeScript 重写版本，专注于提供类型安全和现代化的开发体验。

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://choosealicense.com/licenses/mit/)

## ✨ 主要特点

- 💡 **完整的 TypeScript 类型支持** - 强类型保障，编译时错误检测
- 🔌 **支持所有 OpenAI 兼容服务** - OpenAI、Claude、本地部署等
- 🧩 **模块化设计** - 核心、工具、代理、类型系统独立
- 🔄 **内置多轮对话支持** - 智能消息历史管理
- 📦 **零外部依赖** - 仅需 OpenAI SDK，保持轻量
- 🛠️ **简洁的抽象接口** - 易于理解和使用
- 🧪 **内置测试工具** - 快速原型和测试

## 📁 项目结构

```
HelloAgentsTS/
├── src/
│   ├── core/                 # 核心框架层
│   │   ├── agent.ts         # Agent基类
│   │   ├── config.ts        # 配置管理
│   │   ├── llm.ts           # LLM统一接口
│   │   └── message.ts       # 消息系统
│   ├── agents/              # 预定义代理
│   │   └── simpleAgent.ts   # 简单代理实现
│   ├── tools/               # 工具系统
│   │   ├── base.ts          # 工具基类
│   │   └── registry.ts      # 工具注册表
│   ├── types/               # 类型定义
│   │   ├── agent.ts         # 代理相关类型
│   │   ├── config.ts        # 配置类型
│   │   ├── exceptions.ts    # 异常类型
│   │   ├── llm.ts          # LLM相关类型
│   │   ├── message.ts       # 消息类型
│   │   └── simpleAgent.ts   # 简单代理类型
│   ├── test/                # 测试示例
│   │   ├── firstAgent.ts    # 第一个代理示例
│   │   └── simpleAgent.ts   # 简单代理测试
│   ├── index.ts            # 入口文件
│   └── version.ts          # 版本信息
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装依赖
pnpm install
# 或
npm install

# 配置环境变量
export LLM_API_KEY="你的 API Key"
export LLM_BASE_URL="https://你的服务地址"  # 可选，默认使用 OpenAI
export LLM_MODEL="gpt-3.5-turbo"           # 可选，默认使用 gpt-3.5-turbo
```

### 2. 验证安装

```bash
# 运行类型检查
npx -y tsc --noEmit

# 运行测试示例
npx tsx src/test/simpleAgent.ts
```

## 💻 基础用法

### 简单对话

```typescript
import Config from "./src/core/config.js";
import { Message } from "./src/core/message.js";
import { HelloAgentsLLM } from "./src/core/llm.js";

// 加载配置
const cfg = Config.fromEnv();
const llm = new HelloAgentsLLM({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
});

// 单轮对话
const msg = new Message("你好，介绍一下你自己", "user");
const response = await llm.invoke([msg]);
console.log(response.content);

// 多轮对话
const conversation = [
    new Message("你是一个编程助手", "system"),
    new Message("请解释什么是闭包", "user"),
    new Message("能举个具体例子吗？", "user")
];
const answer = await llm.invoke(conversation);
console.log(answer.content);
```

### 流式输出

```typescript
import { HelloAgentsLLM } from "./src/core/llm.js";
import { Message } from "./src/core/message.js";

const llm = new HelloAgentsLLM(Config.fromEnv());
const msg = new Message("写一个快速排序算法", "user");

console.log("流式输出:");
for await (const chunk of llm.think([msg])) {
    process.stdout.write(chunk);
}
console.log("\n");
```

## 🧠 创建自定义 Agent

### 基础 Agent

```typescript
import { Agent } from "./src/core/agent.js";
import { Message } from "./src/core/message.js";
import { HelloAgentsLLM } from "./src/core/llm.js";
import Config from "./src/core/config.js";

class MathAgent extends Agent {
    constructor() {
        const cfg = Config.fromEnv();
        const llm = new HelloAgentsLLM({
            apiKey: cfg.apiKey,
            baseUrl: cfg.baseUrl,
            model: cfg.model,
        });
        super(llm);
    }

    async run(input: string): Promise<string> {
        const systemMsg = new Message(
            "你是一个专业的数学助手，擅长解决各种数学问题。请提供清晰、准确的解答。",
            "system"
        );
        
        const userMsg = new Message(input, "user");
        const response = await this.llm.invoke([systemMsg, userMsg]);
        
        return response.content;
    }
}

// 使用示例
const mathAgent = new MathAgent();
const result = await mathAgent.run("请计算 23 * 45 + 67");
console.log(result);
```

### 带工具的 Agent

```typescript
import { Agent } from "./src/core/agent.js";
import { HelloAgentsLLM } from "./src/core/llm.js";
import { Message } from "./src/core/message.js";
import Config from "./src/core/config.js";

class CalculatorAgent extends Agent {
    constructor() {
        const cfg = Config.fromEnv();
        const llm = new HelloAgentsLLM({
            apiKey: cfg.apiKey,
            baseUrl: cfg.baseUrl,
            model: cfg.model,
        });
        super(llm);
    }

    async run(input: string): Promise<string> {
        // 简单的计算器逻辑（实际项目中可以集成更复杂的工具）
        if (input.includes("计算") || input.includes("+") || input.includes("*")) {
            try {
                // 安全的数学表达式求值（仅用于演示）
                const expression = input.replace(/[^0-9+\-*/().\s]/g, "");
                if (expression) {
                    const result = Function(`"use strict"; return (${expression})`)();
                    return `计算结果：${result}`;
                }
            } catch (error) {
                return "抱歉，我无法解析这个数学表达式。";
            }
        }

        // 退回到 LLM 处理
        const systemMsg = new Message("你是一个计算器助手，帮助用户进行数学计算。", "system");
        const userMsg = new Message(input, "user");
        const response = await this.llm.invoke([systemMsg, userMsg]);
        
        return response.content;
    }
}
```

## 🛠️ 配置选项

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `LLM_API_KEY` | API 密钥 | 必填 |
| `LLM_BASE_URL` | API 端点地址 | `https://api.openai.com/v1` |
| `LLM_MODEL` | 使用的模型 | `gpt-3.5-turbo` |
| `LLM_TEMPERATURE` | 采样温度 | `0.7` |
| `LLM_MAX_TOKENS` | 最大输出 tokens | 模型默认值 |
| `LLM_TIMEOUT` | 请求超时时间（毫秒） | `30000` |

### 编程式配置

```typescript
import { HelloAgentsLLM } from "./src/core/llm.js";

const llm = new HelloAgentsLLM({
    apiKey: "your-api-key",
    baseUrl: "https://your-llm-endpoint.com/v1",
    model: "your-model-name",
    temperature: 0.5,
    maxTokens: 1000,
    timeout: 15000,
});
```

## 🧪 测试和开发

### 运行测试示例

```bash
# 运行简单代理示例
npx tsx src/test/simpleAgent.ts

# 运行第一个代理示例
npx tsx src/test/firstAgent.ts
```

### 类型检查

```bash
# 完整类型检查
npx -y tsc --noEmit

# 监听模式
npx -y tsc --noEmit --watch
```

### 代码格式化

```bash
# 使用 Prettier 格式化代码
npx prettier --write src/

# 使用 ESLint 检查代码
npx eslint src/
```

## 🔧 高级用法

### 消息管理

```typescript
import { Message } from "./src/core/message.js";

// 创建不同类型的消息
const messages = [
    new Message("你是一个有用的助手", "system", new Date()),
    new Message("用户的问题", "user", new Date()),
    new Message("助手的回答", "assistant", new Date())
];

// 消息可以包含元数据
const userMessage = new Message("问题内容", "user");
userMessage.metadata = {
    userId: "user123",
    sessionId: "session456",
    timestamp: Date.now()
};
```

### 错误处理

```typescript
import { HelloAgentsLLM } from "./src/core/llm.js";
import { APIError, ConfigurationError } from "./src/types/exceptions.js";

try {
    const response = await llm.invoke([message]);
    console.log(response.content);
} catch (error) {
    if (error instanceof APIError) {
        console.error("API 请求失败:", error.message);
    } else if (error instanceof ConfigurationError) {
        console.error("配置错误:", error.message);
    } else {
        console.error("未知错误:", error);
    }
}
```

## 📚 API 参考

### 核心类

#### `HelloAgentsLLM`
主要的 LLM 接口类。

**构造函数参数:**
- `config: LLMConfig` - LLM 配置对象

**方法:**
- `invoke(messages: Message[]): Promise<Message>` - 同步调用
- `think(messages: Message[]): AsyncIterable<string>` - 流式调用

#### `Agent`
Agent 抽象基类。

**构造函数参数:**
- `llm: HelloAgentsLLM` - LLM 实例

**抽象方法:**
- `run(input: string): Promise<string>` - 必须实现的运行方法

#### `Message`
消息类。

**构造函数参数:**
- `content: string` - 消息内容
- `role: 'user' | 'assistant' | 'system'` - 消息角色
- `timestamp?: Date` - 时间戳（可选）

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. **Fork** 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 **Pull Request**

### 开发规范

- 遵循 TypeScript 严格模式
- 使用 Prettier 格式化代码
- 添加必要的类型定义
- 编写清晰的注释
- 确保所有测试通过

### 提交检查清单

- [ ] 代码通过类型检查 (`npx -y tsc --noEmit`)
- [ ] 代码格式正确 (`npx prettier --check src/`)
- [ ] 包含必要的测试
- [ ] 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [OpenAI](https://openai.com/) - 提供强大的 LLM API
- [TypeScript](https://www.typescriptlang.org/) - 提供类型安全
- 社区贡献者的支持和建议

## 📞 联系我们

- 问题反馈：[GitHub Issues](https://github.com/your-username/HelloAgentsTS/issues)
- 功能建议：[GitHub Discussions](https://github.com/your-username/HelloAgentsTS/discussions)
- 邮箱：your-email@example.com

---

**让 AI Agent 开发变得简单而强大！** 🚀
