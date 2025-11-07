// 定义支持的LLM提供商类型
export type SupportedProviders =
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

// 定义LLM调用参数接口
export interface invokeParams {
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
}