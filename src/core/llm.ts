import OpenAI from 'openai';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 定义支持的LLM提供商类型
type SupportedProviders =
    | "openai"
    | "deepseek"
    | "qwen"
    | "modelscope"
    | "kimi"
    | "zhipu"
    | "ollama"
    | "vllm"
    | "local"
    | "auto"
    | "custom";

// 自定义异常类
export class HelloAgentsException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HelloAgentsException";
    }
}

// 消息类型定义
export type ChatMessage = {
    role: "system" | "user" | "assistant" | "function";
    // function 类型的消息在 OpenAI SDK 中需要 name 字段，故此处允许可选 name
    name?: string;
    // content 有时可能是字符串，也可能是结构化对象（例如 function 调用的 arguments）
    content: string | Record<string, any>;
};

// 本地定义一个与 OpenAI SDK 消息结构兼容的轻量类型
type ChatCompletionMessageLike =
    | { role: 'system' | 'user' | 'assistant'; name?: undefined; content: string | null }
    | { role: 'function'; name: string; content: string | null };

/*
    为HelloAgents定制的LLM客户端。
    它用于调用任何兼容OpenAI接口的服务，并默认使用流式响应。

    设计理念：
    - 参数优先，环境变量兜底
    - 流式响应为默认，提供更好的用户体验
    - 支持多种LLM提供商
    - 统一的调用接口
*/
export class HelloAgentsLLM {
    private model: string;
    private temperature: number;
    private maxTokens: number | undefined;
    private timeout: number;
    private kwargs: Record<string, any>;
    private provider: SupportedProviders;
    private apiKey: string;
    private baseUrl: string;
    private _client: OpenAI;

    constructor({
        model,
        apiKey,
        baseUrl,
        provider,
        temperature = 0.7,
        maxTokens,
        timeout,
        ...kwargs
    }: {
        model?: string;
        apiKey?: string;
        baseUrl?: string;
        provider?: SupportedProviders;
        temperature?: number;
        maxTokens?: number;
        timeout?: number;
        [key: string]: any;
    }) {
        // 基础参数初始化
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.timeout = timeout || parseInt(process.env.LLM_TIMEOUT || "60", 10);
        this.kwargs = kwargs;

        // 自动检测提供商
        const requestedProvider = provider?.toLowerCase() as SupportedProviders | undefined;
        this.provider = requestedProvider || this._autoDetectProvider(apiKey, baseUrl);

        // 解析凭证（API密钥和baseUrl）
        if (requestedProvider === "custom") {
            this.provider = "custom";
            this.apiKey = apiKey || process.env.LLM_API_KEY || "";
            this.baseUrl = baseUrl || process.env.LLM_BASE_URL || "";
        } else {
            [this.apiKey, this.baseUrl] = this._resolveCredentials(apiKey, baseUrl);
        }

        // 验证必要参数并设置默认模型
        this.model = model || process.env.LLM_MODEL_ID || this._getDefaultModel();
        if (!this.apiKey || !this.baseUrl) {
            throw new HelloAgentsException("API密钥和服务地址必须被提供或在.env文件中定义。");
        }

        // 创建OpenAI客户端
        this._client = this._createClient();
    }

    /** 自动检测LLM提供商 */
    private _autoDetectProvider(apiKey?: string, baseUrl?: string): SupportedProviders {
        // 1. 检查特定提供商的环境变量
        if (process.env.OPENAI_API_KEY) return "openai";
        if (process.env.DEEPSEEK_API_KEY) return "deepseek";
        if (process.env.DASHSCOPE_API_KEY) return "qwen";
        if (process.env.MODELSCOPE_API_KEY) return "modelscope";
        if (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) return "kimi";
        if (process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY) return "zhipu";
        if (process.env.OLLAMA_API_KEY || process.env.OLLAMA_HOST) return "ollama";
        if (process.env.VLLM_API_KEY || process.env.VLLM_HOST) return "vllm";

        // 2. 根据API密钥格式判断
        const actualApiKey = apiKey || process.env.LLM_API_KEY;
        if (actualApiKey) {
            if (actualApiKey.startsWith("ms-")) return "modelscope";
            if (actualApiKey.toLowerCase() === "ollama") return "ollama";
            if (actualApiKey.toLowerCase() === "vllm") return "vllm";
            if (actualApiKey.toLowerCase() === "local") return "local";
            if (actualApiKey.startsWith("sk-") && actualApiKey.length > 50) return "openai";
            if (actualApiKey.includes(".") && actualApiKey.slice(-20).includes(".")) return "zhipu";
        }

        // 3. 根据baseUrl判断
        const actualBaseUrl = baseUrl || process.env.LLM_BASE_URL;
        if (actualBaseUrl) {
            const baseUrlLower = actualBaseUrl.toLowerCase();
            if (baseUrlLower.includes("api.openai.com")) return "openai";
            if (baseUrlLower.includes("api.deepseek.com")) return "deepseek";
            if (baseUrlLower.includes("dashscope.aliyuncs.com")) return "qwen";
            if (baseUrlLower.includes("api-inference.modelscope.cn")) return "modelscope";
            if (baseUrlLower.includes("api.moonshot.cn")) return "kimi";
            if (baseUrlLower.includes("open.bigmodel.cn")) return "zhipu";
            if (baseUrlLower.includes("localhost") || baseUrlLower.includes("127.0.0.1")) {
                if (baseUrlLower.includes(":11434") || baseUrlLower.includes("ollama")) return "ollama";
                if (baseUrlLower.includes(":8000") && baseUrlLower.includes("vllm")) return "vllm";
                if (baseUrlLower.includes(":8080") || baseUrlLower.includes(":7860")) return "local";
                if (actualApiKey?.toLowerCase() === "ollama") return "ollama";
                if (actualApiKey?.toLowerCase() === "vllm") return "vllm";
                return "local";
            }
            if (["8080", "7860", "5000"].some(port => baseUrlLower.includes(`:${port}`))) return "local";
        }

        // 4. 默认返回auto
        return "auto";
    }

    /** 根据provider解析API密钥和baseUrl */
    private _resolveCredentials(apiKey?: string, baseUrl?: string): [string, string] {
        switch (this.provider) {
            case "openai":
                return [
                    apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api.openai.com/v1"
                ];
            case "deepseek":
                return [
                    apiKey || process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api.deepseek.com"
                ];
            case "qwen":
                return [
                    apiKey || process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
                ];
            case "modelscope":
                return [
                    apiKey || process.env.MODELSCOPE_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api-inference.modelscope.cn/v1/"
                ];
            case "kimi":
                return [
                    apiKey || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api.moonshot.cn/v1"
                ];
            case "zhipu":
                return [
                    apiKey || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4"
                ];
            case "ollama":
                return [
                    apiKey || process.env.OLLAMA_API_KEY || process.env.LLM_API_KEY || "ollama",
                    baseUrl || process.env.OLLAMA_HOST || process.env.LLM_BASE_URL || "http://localhost:11434/v1"
                ];
            case "vllm":
                return [
                    apiKey || process.env.VLLM_API_KEY || process.env.LLM_API_KEY || "vllm",
                    baseUrl || process.env.VLLM_HOST || process.env.LLM_BASE_URL || "http://localhost:8000/v1"
                ];
            case "local":
                return [
                    apiKey || process.env.LLM_API_KEY || "local",
                    baseUrl || process.env.LLM_BASE_URL || "http://localhost:8000/v1"
                ];
            case "custom":
                return [
                    apiKey || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || ""
                ];
            default:
                return [
                    apiKey || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || ""
                ];
        }
    }

    /** 创建OpenAI客户端 */
    private _createClient(): OpenAI {
        return new OpenAI({
            apiKey: this.apiKey,
            baseURL: this.baseUrl,
            timeout: this.timeout * 1000, // OpenAI客户端timeout单位为毫秒
        });
    }

    /** 获取默认模型 */
    private _getDefaultModel(): string {
        switch (this.provider) {
            case "openai": return "gpt-3.5-turbo";
            case "deepseek": return "deepseek-chat";
            case "qwen": return "qwen-plus";
            case "modelscope": return "Qwen/Qwen2.5-72B-Instruct";
            case "kimi": return "moonshot-v1-8k";
            case "zhipu": return "glm-4";
            case "ollama": return "llama3.2";
            case "vllm": return "meta-llama/Llama-2-7b-chat-hf";
            case "local": return "local-model";
            case "custom": return this.model || "gpt-3.5-turbo";
            default:
                const baseUrl = process.env.LLM_BASE_URL || "";
                const baseUrlLower = baseUrl.toLowerCase();
                if (baseUrlLower.includes("modelscope")) return "Qwen/Qwen2.5-72B-Instruct";
                if (baseUrlLower.includes("deepseek")) return "deepseek-chat";
                if (baseUrlLower.includes("dashscope")) return "qwen-plus";
                if (baseUrlLower.includes("moonshot")) return "moonshot-v1-8k";
                if (baseUrlLower.includes("bigmodel")) return "glm-4";
                if (baseUrlLower.includes("ollama") || baseUrlLower.includes(":11434")) return "llama3.2";
                if (baseUrlLower.includes(":8000") || baseUrlLower.includes("vllm")) return "meta-llama/Llama-2-7b-chat-hf";
                if (baseUrlLower.includes("localhost") || baseUrlLower.includes("127.0.0.1")) return "local-model";
                return "gpt-3.5-turbo";
        }

    }

    /**
     * 流式调用LLM（核心方法）
     * @param messages 消息列表
     * @param temperature 温度参数（可选，覆盖初始化值）
     * @returns 流式响应生成器
     */
    /** 将内部 ChatMessage[] 转换为 SDK 期望的消息数组（并确保 function 消息包含 name） */
    private _normalizeMessages(messages: ChatMessage[]): ChatCompletionMessageLike[] {
        return messages.map((m) => {
            // 将 content 确保为 string | null，满足多数 SDK 的 string | null 定义
            let contentStr: string | null;
            if (typeof m.content === 'string') contentStr = m.content;
            else {
                try {
                    contentStr = JSON.stringify(m.content);
                } catch (e) {
                    contentStr = String(m.content as any) || null;
                }
            }

            if (m.role === 'function') {
                // function 消息必须包含 name；若未提供则用占位名避免类型错误
                const name = m.name ?? 'function';
                const out: ChatCompletionMessageLike = { role: 'function', name, content: contentStr };
                return out;
            }
            const out: ChatCompletionMessageLike = { role: m.role as 'system' | 'user' | 'assistant', content: contentStr };
            return out;
        });
    }
    async *think(messages: ChatMessage[], temperature?: number): AsyncGenerator<string, void, void> {
        console.log(`🧠 正在调用 ${this.model} 模型...`);
        try {
            const response = await this._client.chat.completions.create({
                model: this.model,
                messages: this._normalizeMessages(messages) as unknown as any,
                temperature: temperature ?? this.temperature,
                max_tokens: this.maxTokens ?? null,
                stream: true,
                ...this.kwargs,
            });

            console.log("✅ 大语言模型响应成功:");
            for await (const chunk of response) {
                const content = chunk?.choices?.[0]?.delta?.content ?? "";
                if (content) {
                    process.stdout.write(content); // 无缓冲输出
                    yield content;
                }
            }
            console.log(); // 流式输出结束后换行
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`❌ 调用LLM API时发生错误: ${errorMsg}`);
            throw new HelloAgentsException(`LLM调用失败: ${errorMsg}`);
        }
    }

    /**
     * 非流式调用LLM，返回完整响应
     * @param messages 消息列表
     * @param kwargs 额外参数（可覆盖temperature、maxTokens）
     * @returns 完整响应文本
     */
    async invoke(
        messages: ChatMessage[],
        kwargs: { temperature?: number; maxTokens?: number;[key: string]: any } = {}
    ): Promise<string> {
        try {
            const response = await this._client.chat.completions.create({
                model: this.model,
                messages: this._normalizeMessages(messages) as unknown as any,
                temperature: kwargs.temperature ?? this.temperature,
                max_tokens: (kwargs.maxTokens ?? this.maxTokens) ?? null,
                stream: false,
                ...this.kwargs,
                ...Object.fromEntries(
                    Object.entries(kwargs).filter(([k]) => !["temperature", "maxTokens"].includes(k))
                ),
            });
            return response?.choices?.[0]?.message?.content ?? "";
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new HelloAgentsException(`LLM调用失败: ${errorMsg}`);
        }
    }

    /**
     * 流式调用别名（保持向后兼容）
     * @param messages 消息列表
     * @param kwargs 额外参数
     * @returns 流式响应生成器
     */
    async *streamInvoke(
        messages: ChatMessage[],
        kwargs: { temperature?: number;[key: string]: any } = {}
    ): AsyncGenerator<string, void, void> {
        yield* this.think(messages, kwargs.temperature);
    }
}