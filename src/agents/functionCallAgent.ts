import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool, ChatCompletionToolChoiceOption } from "openai/resources";
import Agent from "../core/agent.js";
import type Config from "../core/config.js";
import type HelloAgentsLLM from "../core/llm.js";
import type { ToolParameter } from "../tools/base.js";
import type { ToolRegistry } from "../tools/registry.js";
import { Message } from "../index.js";
import { RuntimeError } from "../types/exceptions.js";

export default class FunctionCallAgent extends Agent {
    toolRegistry: ToolRegistry | undefined;
    enableToolCalling: boolean;
    defaultToolChoice: ChatCompletionToolChoiceOption;
    maxToolIterations: number;

    constructor({
        name,
        llm,
        systemPrompt,
        config,
        toolRegistry = undefined,
        enableToolCalling = true,
        defaultToolChoice = "auto",
        maxToolIterations = 3
    }: {
        name: string;
        llm: HelloAgentsLLM,
        systemPrompt?: string;
        config?: Config;
        toolRegistry?: ToolRegistry;
        enableToolCalling?: boolean;
        defaultToolChoice?: ChatCompletionToolChoiceOption;
        maxToolIterations?: number;
    }) {
        super(name, llm, systemPrompt, config);
        this.toolRegistry = toolRegistry;
        this.enableToolCalling = enableToolCalling && toolRegistry !== undefined && toolRegistry !== null;
        this.defaultToolChoice = defaultToolChoice;
        this.maxToolIterations = maxToolIterations;
    }

    async run({ inputText, ...kwargs }: { inputText: string;[key: string]: any; }): Promise<string> {
        const messages = [];
        const systemPrompt = this._getSystemPrompt();
        messages.push({ role: "system", content: systemPrompt });

        for (const msg of this._history) {
            messages.push({ role: msg.role, content: msg.content });
        }

        messages.push({ role: "user", content: inputText });

        const toolSchemas = this._buildToolSchemas();

        if (!toolSchemas || toolSchemas.length === 0) {
            const responseText = await this.llm.invoke(messages as ChatCompletionMessageParam[], kwargs);
            this.addMessage(new Message("user", inputText));
            this.addMessage(new Message("assistant", responseText));
            return responseText;
        }

        const {
            maxToolIterations,
            toolChoice
        }: {
            maxToolIterations?: number,
            toolChoice?: ChatCompletionToolChoiceOption,
        } = kwargs;

        const iterationsLimit = maxToolIterations || this.maxToolIterations;
        const effectiveToolChoice: ChatCompletionToolChoiceOption = toolChoice || this.defaultToolChoice;

        let currentIteration = 0;
        let finalResponse = '';

        while (currentIteration < iterationsLimit) {
            const response = await this._invokeWithTools({
                messages: messages as ChatCompletionMessageParam[],
                tools: toolSchemas,
                toolChoice: effectiveToolChoice,
                ...kwargs
            });

            const choice = response.choices[0];
            
            if (!choice) {
                throw new RuntimeError("API响应未包含任何选择项");
            }
            const assistantMessage = choice?.message;
            const content = FunctionCallAgent._extractMessageContent(assistantMessage?.content);
            const toolCalls = Array.from(assistantMessage?.tool_calls || [])

            if (toolCalls.length > 0) {
                const assistantPayload: Record<string, any> = { role: "assistant", content: content };
                assistantPayload.tool_calls = [];

                for (const toolCall of toolCalls) {
                    if (toolCall.type === "function") {
                        assistantPayload.tool_calls.push({
                            id: toolCall.id,
                            type: toolCall.type,
                            function: {
                                name: toolCall.function.name,
                                arguments: toolCall.function.arguments,
                            },
                        });
                    }
                }

                messages.push(assistantPayload);

                for (const toolCall of toolCalls) {
                    if (toolCall.type === "function") {
                        const toolName = toolCall.function.name
                        const args = FunctionCallAgent._parseFunctionCallArguments(toolCall.function.arguments);
                        const result = this._executeToolCall(toolName, args);

                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: toolName,
                            content: result
                        })
                    }
                }

                currentIteration++;
                continue;
            }

            finalResponse = content;
            messages.push({ role: "assistant", content: finalResponse });
            break;
        }

        if (currentIteration >= iterationsLimit && !finalResponse) {
            const finalChoice = await this._invokeWithTools({
                messages: messages as ChatCompletionMessageParam[],
                tools: toolSchemas,
                toolChoice: "none",
                ...kwargs,
            });

            if (!finalChoice.choices[0]) {
                throw new RuntimeError("API响应未包含任何选择项");
            }

            finalResponse = FunctionCallAgent._extractMessageContent(finalChoice.choices[0].message.content);
            messages.push({ role: "assistant", content: finalResponse });
        }

        this.addMessage(new Message("user", inputText));
        this.addMessage(new Message("assistant", finalResponse));
        return finalResponse;
    }

    /** 便捷方法：将工具注册到当前Agent */
    async addTool(tool: any): Promise<void> {
        if (!this.toolRegistry) {
            const { ToolRegistry } = await import("../tools/registry.js");
            this.toolRegistry = new ToolRegistry();
            this.enableToolCalling = true;
        }

        if ('autoExpand' in tool && tool.expandable) {
            const expandedTools = tool.getExpandedTools();
            if (expandedTools && expandedTools.length > 0) {
                for (const expandedTool of expandedTools) {
                    this.toolRegistry?.registerTool(expandedTool);
                }
                console.log(`✅ MCP工具 '${tool.name}' 已展开为 ${expandedTools.length} 个独立工具`);
                return;
            }
        }

        this.toolRegistry?.registerTool(tool);
    }

    removeTool(toolName: string): boolean {
        if (this.toolRegistry) {
            const before = new Set(this.toolRegistry.listTools());
            this.toolRegistry.unregisterTool(toolName);
            const after = new Set(this.toolRegistry.listTools());
            return before.has(toolName) && !after.has(toolName);
        }
        return false;
    }

    listTools(): string[] {
        if (this.toolRegistry) {
            return this.toolRegistry.listTools();
        }
        return [];
    }

    hasTools(): boolean {
        return this.enableToolCalling && this.toolRegistry !== undefined;
    }

    /** 流式调用暂未实现，直接回退到一次性调用 */
    async * streamRun({ inputText, ...kwargs }: { inputText: string, [key: string]: any }): AsyncGenerator<string> {
        const result = await this.run({ inputText, ...kwargs });
        yield result;
    }

    private _getSystemPrompt(): string {
        const basePrompt = this.systemPrompt || "你是一个可靠的AI助理，能够在需要时调用合适的工具来完成任务。";
        if (!this.enableToolCalling || !this.toolRegistry) {
            return basePrompt;
        }

        const toolsDescription = this.toolRegistry.getToolsDescription();
        if (!toolsDescription || toolsDescription === "暂无可用工具") {
            return basePrompt;
        }

        let prompt = basePrompt + "\n\n## 可用工具\n";
        prompt += "当你判断需要外部信息或执行动作时，可以直接通过函数调用使用以下工具：\n";
        prompt += toolsDescription + "\n";
        prompt += "\n请主动决定是否调用工具，合理利用多次调用来获得完备答案。";
        return prompt;
    }

    private _buildToolSchemas(): ChatCompletionTool[] {
        if (!this.enableToolCalling || !this.toolRegistry) {
            return [];
        }

        const schemas: ChatCompletionTool[] = [];

        // Tool 对象
        for (const tool of this.toolRegistry.getAllTools()) {
            const properties: Record<string, any> = {};
            const required: string[] = [];
            let parameters: ToolParameter[];

            try {
                parameters = tool.getParameters();
            } catch (error) {
                parameters = [];
            }

            for (const param of parameters) {
                properties[param.name] = {
                    type: this._mapParameterType(param.type),
                    description: param.description || ""
                };

                if (param.default !== undefined) {
                    properties[param.name].default = param.default;
                }

                const isRequired = param.required ?? true;

                if (isRequired) {
                    required.push(param.name);
                }
            }

            const schema: ChatCompletionTool = {
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description || "",
                    parameters: {
                        type: "object",
                        properties: properties,
                    }
                }
            };

            if (required.length > 0) {
                if (schema.function.parameters) {
                    schema.function.parameters.required = required;
                } else {
                    schema.function.parameters = {
                        type: "object",
                        properties: properties,
                        required: required
                    };
                }
            }

            schemas.push(schema);
        }

        // registerFunction 注册的工具（直接访问内部结构）
        const functionMap = this.toolRegistry._functions ?? {};

        for (const [name, info] of Object.entries(functionMap)) {
            schemas.push({
                type: "function",
                function: {
                    name: name,
                    description: info.description || "",
                    parameters: {
                        type: "object",
                        properties: {
                            input: {
                                type: "string",
                                description: "输入文本",
                            }
                        },
                        required: ["input"]
                    }
                }
            });
        }

        return schemas;
    }

    /** 将工具参数类型映射为JSON Schema允许的类型 */
    private _mapParameterType(paramType: string): string {
        const normalized = (paramType || "").toLowerCase();
        if (["string", "number", "integer", "boolean", "array", "object"].includes(normalized)) {
            return normalized;
        }
        return "string";
    }

    /** 调用底层OpenAI客户端执行函数调用 */
    private async _invokeWithTools({
        messages,
        tools,
        toolChoice,
        ...kwargs
    }: {
        messages: ChatCompletionMessageParam[],
        tools: ChatCompletionTool[],
        toolChoice: ChatCompletionToolChoiceOption,
        [key: string]: any
    }): Promise<ChatCompletion> {
        const client = this.llm._client || undefined;
        if (client === undefined) {
            throw new RuntimeError("HelloAgentsLLM 未正确初始化客户端，无法执行函数调用。");
        }

        const clientKwargs = { ...kwargs };

        if (clientKwargs.temperature === undefined) {
            clientKwargs.temperature = this.llm.temperature;
        }
        if (clientKwargs.maxTokens === undefined && this.llm.maxTokens !== undefined) {
            clientKwargs.max_tokens = this.llm.maxTokens;
            delete clientKwargs.maxTokens;
        }

        return await client.chat.completions.create({
            model: this.llm.model,
            messages: messages,
            tools,
            tool_choice: toolChoice,
            ...clientKwargs
        });
    }

    /** 从OpenAI响应的message.content中安全提取文本 */
    private static _extractMessageContent(rawContent: any): string {
        if (rawContent === undefined || rawContent === null) {
            return '';
        }
        if (typeof rawContent === 'string') {
            return rawContent;
        }
        if (Array.isArray(rawContent)) {
            const parts: string[] = [];
            for (const item of rawContent) {
                let text = item.text ?? '';
                if (!text && typeof item === 'object' && item !== null) {
                    text = item.text || '';
                }
                if (text) {
                    parts.push(text);
                }
            }
            return parts.join('');
        }
        return String(rawContent);
    }

    /** 解析模型返回的JSON字符串参数 */
    private static _parseFunctionCallArguments(args?: string): Record<string, any> {
        if (!args) {
            return {}

        }

        try {
            const parsed = JSON.parse(args);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    /** 执行工具调用并返回字符串结果 */
    private async _executeToolCall(toolName: string, args: Record<string, any>): Promise<string> {
        if (!this.toolRegistry) {
            return "❌ 错误：未配置工具注册表";
        }

        const tool = this.toolRegistry.getTool(toolName);
        if (tool) {
            try {
                const typedArguments = this._convertParameterTypes(toolName, args);
                return await tool.run(typedArguments);
            } catch (error) {
                return `❌ 工具调用失败：${error}`;
            }
        }

        const func = this.toolRegistry.getFunction(toolName);
        if (func) {
            try {
                const inputText = args["input"] || "";
                return func(inputText);
            } catch (error) {
                return `❌ 工具调用失败：${error}`;
            }
        }

        return `❌ 错误：未找到工具 '${toolName}'`;
    }

    /** 根据工具定义尽可能转换参数类型 */
    private _convertParameterTypes(toolName: string, paramObject: Record<string, any>): Record<string, any> {
        if (!this.toolRegistry) {
            return paramObject;
        }

        const tool = this.toolRegistry.getTool(toolName);
        if (!tool) {
            return paramObject;
        }

        let toolParams: ToolParameter[];
        try {
            toolParams = tool.getParameters();
        } catch (error) {
            return paramObject;
        }

        const typeMapping: Record<string, string> = {};
        for (const param of toolParams) {
            typeMapping[param.name] = param.type;
        }

        const converted: Record<string, any> = {};

        for (const [key, value] of Object.entries(paramObject)) {
            const paramType = typeMapping[key];
            if (!paramType) {
                converted[key] = value;
                continue;
            }

            try {
                const normalized = paramType.toLowerCase();
                if (["number", "float"].includes(normalized)) {
                    converted[key] = typeof value === 'string' ? parseFloat(value) : Number(value);
                } else if (["integer", "int"].includes(normalized)) {
                    converted[key] = typeof value === 'string' ? parseInt(value, 10) : Math.floor(Number(value));
                } else if (["boolean", "bool"].includes(normalized)) {
                    if (typeof value === "boolean") {
                        converted[key] = value;
                    } else if (typeof value === "number") {
                        converted[key] = Boolean(value);
                    } else if (typeof value === "string") {
                        converted[key] = ["true", "1", "yes"].includes(value.toLowerCase());
                    } else {
                        converted[key] = Boolean(value);
                    }
                } else {
                    converted[key] = value;
                }
            } catch (error) {
                converted[key] = value;
            }
        }

        return converted;
    }
}
