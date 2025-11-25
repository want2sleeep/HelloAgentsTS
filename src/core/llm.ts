import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources";
import type { SupportedProviders, invokeParams } from "../types/llm.js";
import { HelloAgentsException } from "../types/exceptions.js";
import type Message from "./message.js";

/**
 *  为HelloAgents定制的LLM客户端。
 *  它用于调用任何兼容OpenAI接口的服务，并默认使用流式响应。
 *
 *  设计理念：
 *  - 参数优先，环境变量兜底
 *  - 流式响应为默认，提供更好的用户体验
 *  - 支持多种LLM提供商
 *  - 统一的调用接口
 */
export default class HelloAgentsLLM {
    model: string;
    temperature: number;
    maxTokens?: number | undefined;
    timeout: number;
    kwargs: Record<string, any>;
    provider: SupportedProviders | undefined;
    apiKey: string | undefined;
    baseUrl: string | undefined;
    _client: OpenAI | undefined;

    constructor({
        model = "",
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
        provider?: SupportedProviders | undefined;
        temperature?: number;
        maxTokens?: number | undefined;
        timeout?: number;
        [key: string]: any;
    } = {}) {
        // 优先使用传入参数，如果未提供，则从环境变量加载
        this.model = model || process.env.LLM_MODEL_ID || "";
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.timeout = timeout || parseInt(process.env.LLM_TIMEOUT || "180", 10);
        this.kwargs = kwargs;

        // 自动检测provider或使用指定的provider
        const requestedProvider = provider ? (provider.toLowerCase() as SupportedProviders) : null;
        this.provider = requestedProvider || this._autoDetectProvider(apiKey, baseUrl);

        if (requestedProvider === "custom") {
            this.provider = "custom";
            this.apiKey = apiKey || process.env.LLM_API_KEY;
            this.baseUrl = baseUrl || process.env.LLM_BASE_URL;
        } else {
            // 根据provider确定API密钥和baseUrl
            [this.apiKey, this.baseUrl] = this._resolveCredentials(apiKey, baseUrl);
        }

        // 验证必要参数
        if (!this.model) {
            this.model = this._getDefaultModel();
        }
        if (!this.apiKey || !this.baseUrl) {
            throw new HelloAgentsException("API密钥和baseUrl必须被提供或在.env文件中定义。");
        }

        // 创建OpenAI客户端
        this._client = this._createClient();
    }

    /**
     * 调用大语言模型进行思考，并返回流式响应。
     * 这是主要的调用方法，默认使用流式响应以获得更好的用户体验。
     *
     * @param messages 消息列表
     * @param temperature 温度参数，如果未提供则使用初始化时的值
     * @yields 流式响应的文本片段
     */
    async *think(messages: Message[], temperature?: number): AsyncIterableIterator<string> {
        console.log(`🧠 正在调用 ${this.model} 模型...`);
        try {
            const response = await this._client?.chat.completions.create({
                model: this.model || "",
                messages: messages as ChatCompletionMessageParam[],
                temperature: temperature ?? this.temperature,
                max_tokens: this.maxTokens ?? null,
                stream: true,
            });

            // 处理流式响应
            console.log("✅ 大语言模型响应成功:");
            if (!response) {
                throw new HelloAgentsException("LLM 返回空响应");
            }
            for await (const chunk of response) {
                const content = chunk?.choices?.[0]?.delta?.content || "";
                if (content && content.trim() !== "") {
                    process.stdout.write(content);

                    // 确保在终端环境中立即刷新
                    if (process.stdout.isTTY) {
                        // 避免非终端环境下，执行无意义的空字符串写入操作（减少冗余开销、避免潜在格式问题）
                        process.stdout.write("\x1B[0G"); // 光标移到行首（不影响内容，同样触发刷新）
                    }

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
     * 适用于不需要流式输出的场景
     *
     * @param messages 消息列表
     * @param kwargs 额外参数
     * @returns 完整响应文本
     */
    async invoke(messages: ChatCompletionMessageParam[], kwargs: invokeParams = {}): Promise<string> {
        try {
            const { temperature, maxTokens, ...otherParams } = kwargs;
            const response = await this._client?.chat.completions.create({
                model: this.model || "",
                messages: messages,
                temperature: temperature ?? this.temperature,
                max_tokens: maxTokens ?? this.maxTokens ?? null,
                ...otherParams,
                ...this.kwargs,
            });
            const content = response?.choices?.[0]?.message?.content;

            if (!content) {
                throw new HelloAgentsException("LLM 返回空响应");
            }

            return content;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new HelloAgentsException(`LLM调用失败: ${errorMsg}`);
        }
    }

    /**
     * 流式调用LLM的别名方法，与think方法功能相同。
     * 保持向后兼容性。
     * @param messages 消息列表
     * @param kwargs 额外参数
     * @returns 流式响应生成器
     */
    async *streamInvoke(
        messages: Message[],
        kwargs: invokeParams = {}
    ): AsyncIterableIterator<string> {
        yield* this.think(messages, kwargs.temperature);
    }

    /**
     * 自动检测LLM提供商
     *
     * 检测逻辑：
     * 1. 优先检查特定提供商的环境变量
     * 2. 根据API密钥格式判断
     * 3. 根据base_url判断
     * 4. 默认返回通用配置
     *
     * @param apiKey 可选的API密钥
     * @param baseUrl 可选的baseUrl
     * @returns 检测到的LLM提供商
     */
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
            const actualApiKeyLower = actualApiKey.toLowerCase();

            if (actualApiKey.startsWith("ms-")) return "modelscope";
            if (actualApiKeyLower === "ollama") return "ollama";
            if (actualApiKeyLower === "vllm") return "vllm";
            if (actualApiKeyLower === "local") return "local";
            if (actualApiKeyLower.endsWith(".") && actualApiKeyLower.slice(-20).includes(".")) return "zhipu";
        }

        // 3. 根据baseUrl判断
        const actualBaseUrl = baseUrl || process.env.LLM_BASE_URL;

        if (actualBaseUrl) {
            const baseUrlLower = actualBaseUrl.toLowerCase();

            if (baseUrlLower.includes("api.openai.com")) return "openai";
            else if (baseUrlLower.includes("api.deepseek.com")) return "deepseek";
            else if (baseUrlLower.includes("dashscope.aliyuncs.com")) return "qwen";
            else if (baseUrlLower.includes("api-inference.modelscope.cn")) return "modelscope";
            else if (baseUrlLower.includes("api.moonshot.cn")) return "kimi";
            else if (baseUrlLower.includes("open.bigmodel.cn")) return "zhipu";
            else if (baseUrlLower.includes("localhost") || baseUrlLower.includes("127.0.0.1")) {
                // 本地部署检测 - 优先检查特定服务
                if (baseUrlLower.includes(":11434") || baseUrlLower.includes("ollama")) return "ollama";
                else if (baseUrlLower.includes(":8000") && baseUrlLower.includes("vllm")) return "vllm";
                else if (baseUrlLower.includes(":8080") || baseUrlLower.includes(":7860")) return "local";
                else {
                    // 根据API密钥进一步判断
                    if (actualApiKey && actualApiKey.toLowerCase() === "ollama") return "ollama";
                    else if (actualApiKey && actualApiKey.toLowerCase() === "vllm") return "vllm";
                    else return "local";
                }
            } else if (["8080", "7860", "5000"].some(port => baseUrlLower.includes(`:${port}`))) {
                // 常见的本地部署端口
                return "local";
            }
        }

        // 4. 默认返回auto
        return "auto";
    }

    /**
     * 根据provider解析API密钥和baseUrl
     * @param apiKey 可选的API密钥
     * @param baseUrl 可选的baseUrl
     * @returns 包含API密钥和baseUrl的元组
     */
    private _resolveCredentials(apiKey?: string, baseUrl?: string): readonly [string, string] {
        switch (this.provider) {
            case "openai":
                return [
                    apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api.openai.com/v1",
                ];
            case "deepseek":
                return [
                    apiKey || process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
                ];
            case "qwen":
                return [
                    apiKey || process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
                ];
            case "modelscope":
                return [
                    apiKey || process.env.MODELSCOPE_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api-inference.modelscope.cn/v1/",
                ];
            case "kimi":
                return [
                    apiKey || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://api.moonshot.cn/v1",
                ];
            case "zhipu":
                return [
                    apiKey || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY || process.env.LLM_API_KEY || "",
                    baseUrl || process.env.LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
                ];
            case "ollama":
                return [
                    apiKey || process.env.OLLAMA_API_KEY || process.env.LLM_API_KEY || "ollama",
                    baseUrl || process.env.OLLAMA_HOST || process.env.LLM_BASE_URL || "http://localhost:11434/v1",
                ];
            case "vllm":
                return [
                    apiKey || process.env.VLLM_API_KEY || process.env.LLM_API_KEY || "vllm",
                    baseUrl || process.env.VLLM_HOST || process.env.LLM_BASE_URL || "http://localhost:8000/v1",
                ];
            case "local":
                return [
                    apiKey || process.env.LLM_API_KEY || "local",
                    baseUrl || process.env.LLM_BASE_URL || "http://localhost:8000/v1",
                ];
            case "custom":
                return [apiKey || process.env.LLM_API_KEY || "", baseUrl || process.env.LLM_BASE_URL || ""];
            default:
                // auto或其他情况：使用通用配置，支持任何OpenAI兼容的服务
                return [apiKey || process.env.LLM_API_KEY || "", baseUrl || process.env.LLM_BASE_URL || ""];
        }
    }

    /**
     * 创建OpenAI客户端
     * @returns OpenAI客户端实例
     */
    private _createClient(): OpenAI {        
        return new OpenAI({
            apiKey: this.apiKey,
            baseURL: this.baseUrl,
            timeout: this.timeout * 1000,
        });
    }

    /**
     * 获取默认模型
     * @returns 默认模型名称
     */
    private _getDefaultModel(): string {
        switch (this.provider) {
            case "openai":
                return "gpt-3.5-turbo";
            case "deepseek":
                return "deepseek-chat";
            case "qwen":
                return "qwen-plus";
            case "modelscope":
                return "Qwen/Qwen2.5-72B-Instruct";
            case "kimi":
                return "moonshot-v1-8k";
            case "zhipu":
                return "glm-4";
            case "ollama":
                return "llama3.2"; // Ollama常用模型
            case "vllm":
                return "meta-llama/Llama-2-7b-chat-hf"; // vLLM常用模型
            case "local":
                return "local-model"; // 本地模型占位符
            case "custom":
                return this.model || "gpt-3.5-turbo";
            default:
                // auto或其他情况：根据base_url智能推断默认模型
                const baseUrl = process.env.LLM_BASE_URL || "";
                const baseUrlLower = baseUrl.toLowerCase();

                if (baseUrlLower.includes("modelscope")) return "Qwen/Qwen2.5-72B-Instruct";
                else if (baseUrlLower.includes("deepseek")) return "deepseek-chat";
                else if (baseUrlLower.includes("dashscope")) return "qwen-plus";
                else if (baseUrlLower.includes("moonshot")) return "moonshot-v1-8k";
                else if (baseUrlLower.includes("bigmodel")) return "glm-4";
                else if (baseUrlLower.includes("ollama") || baseUrlLower.includes(":11434")) return "llama3.2";
                else if (baseUrlLower.includes("vllm") || baseUrlLower.includes(":8000"))
                    return "meta-llama/Llama-2-7b-chat-hf";
                else if (baseUrlLower.includes("localhost") || baseUrlLower.includes("127.0.0.1")) return "local-model";
                else return "gpt-3.5-turbo";
        }
    }
}

