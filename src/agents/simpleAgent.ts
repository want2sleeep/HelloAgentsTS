import Agent from "../core/agent.js";
import Message from "../core/message.js";
import type Config from "../core/config.js";
import type HelloAgentsLLM from "../core/llm.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Tool } from "../tools/base.js";
import type { ChatCompletionMessageParam } from "openai/resources";
import type { ToolCall } from "../types/simpleAgent.js";

export class SimpleAgent extends Agent {
    public toolRegistry: ToolRegistry | undefined;
    public enableToolCalling: boolean;

    constructor({
        name,
        llm,
        systemPrompt,
        config,
        toolRegistry,
        enableToolCalling = true,
    }: {
        name: string,
        llm: HelloAgentsLLM,
        systemPrompt?: string,
        config?: Config,
        toolRegistry?: ToolRegistry,
        enableToolCalling?: boolean,
    }) {
        super(name, llm, systemPrompt, config);
        this.toolRegistry = toolRegistry;
        this.enableToolCalling = enableToolCalling && !!toolRegistry;
    }

    /**
    * 运行SimpleAgent，支持可选的工具调用
    * 
    * @param inputText 用户输入
    * @param kwargs 其他参数
    * @returns Agent响应
    */
    async run({
        inputText,
        maxToolIterations = 3,
        ...kwargs
    }: {
        inputText: string,
        maxToolIterations?: number,
        [key: string]: any
    }): Promise<string> {        
        // 构建消息列表
        const messages: ChatCompletionMessageParam[] = []

        // 添加系统信息（可能包含工具信息）
        const enhancedPrompt = this._getEnhancedSystemPrompt();
        messages.push({ role: "system", content: enhancedPrompt });

        // 添加历史记录
        for (const msg of this._history) {
            // 过滤掉不兼容的 role 类型
            if (msg.role === "tool") continue;
            messages.push({ role: msg.role, content: msg.content });
        }

        // 添加用户信息
        messages.push({ role: "user", content: inputText });

        // 如果没有启用工具调用，使用简单对话逻辑
        if (!this.enableToolCalling) {
            const response = await this.llm.invoke(messages, kwargs);
            this.addMessage(new Message("user", inputText));
            this.addMessage(new Message("assistant", response));
            console.log(`${this.name} 响应完成`);
            return response;
        }

        // 迭代处理，支持多轮工具调用
        let currentIteration = 0;
        let finalResponse = "";
        let currentMessages = [...messages];

        while (currentIteration < maxToolIterations) {
            // 调用LLM
            const response = await this.llm.invoke(currentMessages, kwargs);

            // 检查是否有工具调用
            const toolCalls = this._parseToolCalls(response);

            if (!toolCalls.length) {
                // 执行所有工具调用并收集结果
                const toolResults: string[] = [];
                let cleanResponse = response;

                for (const call of toolCalls) {
                    try {
                        const result = await this._executeToolCall(call.toolName || "", call.parameters || "");
                        toolResults.push(result);
                        // 从响应中移除工具调用标记
                        cleanResponse = cleanResponse.replace(call.original || "", "");
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        toolResults.push(`工具调用失败: ${errorMsg}`);
                    }
                }

                // 构建包含工具结果的消息
                messages.push({ role: "assistant", content: cleanResponse });

                // 添加工具结果
                const toolResultsText = toolResults.join("\n\n");
                messages.push({
                    role: "user",
                    content: `工具执行结果：\n${toolResultsText}\n\n请基于这些结果给出完整的回答。`
                });

                currentIteration++;
                continue;
            }

            // 没有工具调用，这是最终回答
            finalResponse = response;
            break;
        }

        // 如果超过最大迭代次数，获取最后一次回答
        if (currentIteration >= maxToolIterations && !finalResponse) {
            finalResponse = await this.llm.invoke(currentMessages, kwargs);
        }

        // 保存到历史记录
        this.addMessage(new Message("user", inputText));
        this.addMessage(new Message("assistant", finalResponse));

        return finalResponse;
    }

    /**
     * 流式运行
     * 
     * @param inputText 用户输入
     * @param kwargs 其他参数
     * @returns 流式响应迭代器
     */
    async * streamRun(
        inputText: string,
        kwargs: Record<string, any> = {}
    ): AsyncGenerator<string, void, undefined> {
        const messages: Message[] = []

        if (this.systemPrompt) {
            messages.push(new Message("system", this.systemPrompt))
        }

        for (const msg of this._history) {
            messages.push(msg)
        }

        messages.push(new Message("user", inputText))

        // 流式调用LLM
        let fullResponse = ""
        process.stdout.write("📝 实时响应: ");

        for await (const chunk of this.llm.streamInvoke(messages, kwargs)) {
            fullResponse += chunk
            process.stdout.write(chunk);
            yield chunk
        }

        console.log()  // 换行

        // 保存完整对话到历史记录
        this.addMessage(new Message("user", inputText))
        this.addMessage(new Message("assistant", fullResponse))
        console.log(`✅ ${this.name} 流式响应完成`)
    }

    /**
     * 添加工具到Agent（便利方法）
     * 如果工具是可展开的（expandable=true），会自动展开为多个独立工具
     * 
     * @param tool - Tool对象
     * @param autoExpand - 是否自动展开可展开的工具（默认true）
     */
    async addTool(
        tool: Tool,
        autoExpand: boolean = true
    ): Promise<void> {
        if (!this.toolRegistry) {
            this.toolRegistry = new (await import("../tools/registry.js")).ToolRegistry()
            this.enableToolCalling = true
        }

        // 直接使用 ToolRegistry 的 registerTool 方法，ToolRegistry 会自动处理工具展开
        this.toolRegistry.registerTool(tool, autoExpand)
    }

    /**
     * 检查是否有可用工具
     * @returns 是否有可用工具
     */
    hasTools(): boolean {
        return this.enableToolCalling && !!this.toolRegistry;
    }

    /**
     * 移除工具（便利方法）
     * @param toolName 要移除的工具名称
     * @returns 是否移除成功
     */
    removeTool(toolName: string): boolean {
        if (this.toolRegistry) {
            this.toolRegistry.unregisterTool(toolName);
            return true;
        }
        return false;
    }

    /**
     * 列出所有可用工具
     * @returns 工具名称列表
     */
    listTools(): string[] {
        if (this.toolRegistry) {
            return this.toolRegistry.listTools();
        }
        return [];
    }

    /**
     * 生成增强的提示
     * - 包含系统提示（如果有）
     * - 包含工具注册信息（如果启用了工具调用）
     */
    private _getEnhancedSystemPrompt(): string {
        const basePrompt = this.systemPrompt || "你是一个有用的AI助手";

        if (!this.enableToolCalling || !this.toolRegistry) {
            return basePrompt;
        }

        // 获取工具描述
        const toolsDescription = this.toolRegistry.getToolsDescription();
        if (!toolsDescription || toolsDescription === "暂无可用工具") {
            return basePrompt;
        }

        let toolsSection = "\n\n## 可用工具\n";

        toolsSection += "你可以使用以下工具来帮助回答问题:\n"
        toolsSection += toolsDescription + "\n"

        toolsSection += "\n## 工具调用格式\n"
        toolsSection += "当需要使用工具时，请使用以下格式:\n"
        toolsSection += "`[TOOL_CALL:{tool_name}:{parameters}]`\n"
        toolsSection += "例如:`[TOOL_CALL:search:Python编程]` 或 `[TOOL_CALL:memory:recall=用户信息]`\n\n"
        toolsSection += "工具调用结果会自动插入到对话中，然后你可以基于结果继续回答。\n"

        return basePrompt + toolsSection;
    }

    /**
     * 解析文本中的工具调用。
     * @param text 要解析的文本
     * @returns 返回一个包含所有工具调用信息的数组
     */
    private _parseToolCalls(text: string): ToolCall[] {
        const pattern = /\[TOOL_CALL:([^:]+):([^\]]+)\]/g;
        const matches = text.matchAll(pattern);
        const toolCalls: ToolCall[] = [];

        for (const [toolName, parameters] of matches) {
            toolCalls.push({
                toolName: toolName.trim(),
                parameters: parameters ? parameters.trim() : "",
                original: `[TOOL_CALL:${toolName}:${parameters}]`,
            });
        }

        return toolCalls;
    }

    // 执行工具调用
    private async _executeToolCall(toolName: string, parameters: string): Promise<string> {
        if (!this.toolRegistry) {
            return "❌ 错误:未配置工具注册表";
        }

        try {
            // 获取 Tool 对象
            let tool = this.toolRegistry.getTool(toolName);

            if (!tool) {
                return `❌ 错误：未找到工具 '${toolName}'`
            }

            // 智能参数解析
            const paramDict = this._parseToolParameters(toolName, parameters);

            // 调用工具
            const result = await tool.run(paramDict)
            return `🔧 工具 ${toolName} 执行结果：\n${result}`
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return `❌ 工具调用失败:${errorMsg}`
        }
    }

    private _parseToolParameters(toolName: string, parameters: string): Record<string, any> {
        let paramDict: Record<string, any> = {};

        // 尝试解析JSON格式
        if (parameters.trim().startsWith("{")) {
            try {
                paramDict = JSON.parse(parameters);
                // JSON解析成功，进行类型转换
                paramDict = this._convertParameterTypes(toolName, paramDict);
                // 推断 action（如果未提供）
                if (!("action" in paramDict)) {
                    paramDict = this._inferAction(toolName, paramDict);
                }
                return paramDict;
            } catch (error) { }
        }

        if (parameters.includes("=")) {
            // 格式：key=value 或 action=search,query=Python
            if (parameters.includes(",")) {
                // 多个参数： action=search,query=Python,limit=3
                const pairs = parameters.split(",");
                for (const pair of pairs) {
                    if (pair.includes("=")) {
                        const [key, value] = pair.split("=", 1);
                        if (key !== undefined && value !== undefined) {
                            paramDict[key.trim()] = value.trim();
                        }
                    }
                }
            } else {
                // 单个参数： key=value
                const [key, value] = parameters.split("=", 1);
                if (key !== undefined && value !== undefined) {
                    paramDict[key.trim()] = value.trim();
                }
            }

            // 类型转换
            paramDict = this._convertParameterTypes(toolName, paramDict);

            // 智能推断 action（如果没有指定）
            if (!("action" in paramDict)) {
                paramDict = this._inferAction(toolName, paramDict);
            }
        } else {
            // 直接传入参数，根据工具类型智能推断
            paramDict = this._inferSimpleParameters(toolName, parameters);
        }

        return paramDict;
    }

    /**
     * 根据工具的参数定义转换参数类型
     * @param toolName 工具名称
     * @param paramDict 参数字典
     * @returns 类型转换后的参数字典
     */
    private _convertParameterTypes(toolName: string, paramDict: Record<string, any>): Record<string, any> {
        if (!this.toolRegistry) return paramDict;
        const tool = this.toolRegistry.getTool(toolName);
        if (!tool) return paramDict;

        // 获取工具的参数定义（兼容未实现的工具）
        let toolParams: Array<{ name: string; type: string }> | undefined;
        try {
            const maybeGetter: unknown = (tool as any).getParameters ?? (tool as any).get_parameters;
            if (typeof maybeGetter === "function") {
                toolParams = (maybeGetter as Function).call(tool);
            }
        } catch {
            // 忽略获取失败，直接返回原字典
            return paramDict;
        }
        if (!toolParams || !Array.isArray(toolParams)) return paramDict;

        // 创建参数类型映射
        const paramTypes: Record<string, string> = {};
        for (const p of toolParams) {
            if (p && typeof p.name === "string" && typeof p.type === "string") {
                paramTypes[p.name] = p.type.toLowerCase();
            }
        }

        // 转换参数类型
        const converted: Record<string, any> = {};
        for (const [key, value] of Object.entries(paramDict)) {
            const targetType = paramTypes[key];
            if (!targetType) {
                converted[key] = value;
                continue;
            }
            try {
                if (targetType === "number" || targetType === "integer") {
                    if (typeof value === "string") {
                        converted[key] = targetType === "number" ? parseFloat(value) : parseInt(value, 10);
                    } else {
                        converted[key] = value;
                    }
                } else if (targetType === "boolean") {
                    if (typeof value === "string") {
                        converted[key] = ["true", "1", "yes"].includes(value.toLowerCase());
                    } else {
                        converted[key] = Boolean(value);
                    }
                } else {
                    converted[key] = value;
                }
            } catch {
                // 转换失败，保持原值
                converted[key] = value;
            }
        }

        return converted;
    }

    /**
     * 根据工具类型和参数推断 action
     * @param toolName 工具名称
     * @param paramDict 参数字典
     * @returns 补全/推断后的参数字典
     */
    private _inferAction(toolName: string, paramDict: Record<string, any>): Record<string, any> {
        if (toolName === "memory") {
            if ("recall" in paramDict) {
                paramDict.action = "search";
                paramDict.query = paramDict.recall;
                delete paramDict.recall;
            } else if ("store" in paramDict) {
                paramDict.action = "add";
                paramDict.content = paramDict.store;
                delete paramDict.store;
            } else if ("query" in paramDict) {
                paramDict.action = "search";
            } else if ("content" in paramDict) {
                paramDict.action = "add";
            }
        } else if (toolName === "rag") {
            if ("search" in paramDict) {
                paramDict.action = "search";
                paramDict.query = paramDict.search;
                delete paramDict.search;
            } else if ("query" in paramDict) {
                paramDict.action = "search";
            } else if ("text" in paramDict) {
                paramDict.action = "add_text";
            }
        }

        return paramDict;
    }

    /**
     * 为简单参数推断完整的参数字典
     * @param toolName 工具名称
     * @param parameters 纯文本参数
     * @returns 推断后的参数字典
     */
    private _inferSimpleParameters(toolName: string, parameters: string): Record<string, any> {
        if (toolName === "rag") {
            return { action: "search", query: parameters };
        } else if (toolName === "memory") {
            return { action: "search", query: parameters };
        } else return { input: parameters };
    }
}