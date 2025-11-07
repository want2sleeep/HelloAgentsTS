import Agent from "../core/agent.js";
import Message from "../core/message.js";
import type Config from "../core/config.js";
import type { ChatMessage, HelloAgentsLLM } from "../core/llm.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Tool } from "../tools/base.js";

export class SimpleAgent extends Agent {
    tool_registry: ToolRegistry | undefined;
    enable_tool_calling: boolean;
    system_prompt: string | undefined;

    constructor(
        name: string,
        llm: HelloAgentsLLM,
        system_prompt?: string,
        config?: Config,
        tool_registry?: ToolRegistry,
        enable_tool_calling: boolean = true,
    ) {
        super(name, llm, system_prompt, config);
        this.tool_registry = tool_registry;
        this.enable_tool_calling = enable_tool_calling && !!tool_registry;
    }

    async run(input_text: string, max_tool_iterations: number = 3, kwargs?: Record<string, any>): Promise<string> {
        // 构建消息列表
        const messages: ChatMessage[] = []

        // 添加系统信息（可能包含工具信息）
        const enhanced_prompt = this._get_enhanced_prompt();
        messages.push({ role: "system", content: enhanced_prompt });

        // 添加历史记录
        for (const msg of this._history) {
            // 过滤掉不兼容的 role 类型
            if (msg.role === "tool") continue;
            messages.push({ role: msg.role as "system" | "user" | "assistant", content: msg.content });
        }

        // 添加用户信息
        messages.push({ role: "user", content: input_text });

        // 如果没有启用工具调用，使用简单对话逻辑
        if (!this.enable_tool_calling) {
            const response = await this.llm.invoke(messages, kwargs);
            this.add_message(new Message(input_text, "user"));
            this.add_message(new Message(response, "assistant"));
            console.log(`${this.name} 响应完成`);
            return response;
        }

        // 支持多轮工具调用的逻辑
        return this._run_with_tools(messages, input_text, max_tool_iterations, kwargs);
    }

    /**
     * 生成增强的提示
     * - 包含系统提示（如果有）
     * - 包含工具注册信息（如果启用了工具调用）
     */
    _get_enhanced_prompt(): string {
        const base_prompt = this.system_prompt || "你是一个有用的AI助手";

        if (!this.enable_tool_calling || !this.tool_registry) {
            return base_prompt;
        }

        // 获取工具描述
        const tools_description = this.tool_registry.get_tools_description();
        if (!tools_description || tools_description === "暂无可用工具") {
            return base_prompt;
        }

        let tools_section = "\n\n## 可用工具\n";

        tools_section += "你可以使用以下工具来帮助回答问题:\n"
        tools_section += tools_description + "\n"

        tools_section += "\n## 工具调用格式\n"
        tools_section += "当需要使用工具时，请使用以下格式:\n"
        tools_section += "`[TOOL_CALL:{tool_name}:{parameters}]`\n"
        tools_section += "例如:`[TOOL_CALL:search:Python编程]` 或 `[TOOL_CALL:memory:recall=用户信息]`\n\n"
        tools_section += "工具调用结果会自动插入到对话中，然后你可以基于结果继续回答。\n"

        return base_prompt + tools_section;
    }

    _run_with_tools(messages: ChatMessage[], input_text: string, max_tool_iterations: number, kwargs?: Record<string, any>): string {
        let current_iteration = 0
        let final_response = ""

        while (current_iteration < max_tool_iterations) {
            // 调用LLM
            let response = this.llm.invoke(messages, kwargs);

            // 检查是否有工具调用
            let tool_calls = this._parse_tool_calls(response);

            if (tool_calls) {
                console.log(`🔧 检测到 ${tool_calls.length} 个工具调用`);

                // 执行所有工具调用并收集结果
                const tool_results = [];
                let clean_response = response;

                for (const call of tool_calls) {
                    const result = this._execute_tool_call();
                    tool_results.push(result);

                    // 从响应中移除工具调用标记
                    clean_response
                }

                // 构建包含工具结果的消息
                messages.push({ role: "assistant", content: clean_response });

                // 添加工具结果
                const tool_results_text = tool_results.join("\n\n");
                messages.push({ role: "user", content: `工具执行结果:\n${tool_results_text}\n\n请基于这些结果给出完整的回答。` })

                current_iteration++;
                continue;
            }

            // 没有工具调用，这是最终回答
            final_response = response;
            break;
        }

        // 如果超过最大迭代次数，获取最后一次回答
        if (current_iteration >= max_tool_iterations && !final_response) {
            final_response = this.llm.invoke(messages, kwargs);
        }

        // 保存到历史记录
        this.add_message(Message(input_text, "user"));
        this.add_message(Message(final_response, "assistant"));
        console.log(`${this.name} 响应完成`);

        return final_response;
    }

    /**
     * 解析文本中的工具调用。
     * @param text 要解析的文本
     * @returns 返回一个包含所有工具调用信息的数组
     */
    private _parse_tool_calls(text: string): Record<string, string>[] {
        const pattern = /\[TOOL_CALL:([^:]+):([^\]]+)\]/g;
        const matches = text.matchAll(pattern);
        const tool_calls = [];

        for (const [tool_name, parameters] of matches) {
            tool_calls.push({
                tool_name: tool_name.trim(),
                parameters: parameters ? parameters.trim() : "",
                original: `[TOOL_CALL:${tool_name}:${parameters}]`,
            });
        }

        return tool_calls;
    }

    // 执行工具调用
    _execute_tool_call(tool_name: string, parameters: string): string {
        if (!this.tool_registry) {
            return "❌ 错误:未配置工具注册表";
        }

        try {
            let result: string = '';

            // 智能参数解析
            if (tool_name === 'calculator') {
                // 计算器工具直接传入表达式
                result = this.tool_registry.execute_tool(tool_name, parameters);
            } else {
                // 其他工具使用智能参数解析
                const param_dict = this._parse_tool_parameters(tool_name, parameters);
                const tool = this.tool_registry.get_tool(tool_name);
                if (!tool) {
                    return `❌ 错误:未找到工具 '${tool_name}'`;
                }
                result = tool.run(param_dict);
            }
            return `🔧 工具 ${tool_name} 执行结果:\n${result}`;
        } catch (e: any) {
            return `❌ 工具调用失败:${e.message}`
        }
    }

    _parse_tool_parameters(tool_name: string, parameters: string): Record<string, string> {
        let param_dict: Record<string, string> = {};

        if (parameters.includes('=')) {
            // 格式：key=value 或 action=search,query=Python
            if (parameters.includes(',')) {
                // 多个参数： action=search,query=Python,limit=3
                const pairs = parameters.split(',');
                for (const pair of pairs) {
                    if (pair.includes('=')) {
                        const [key, value] = pair.split('=', 1);
                        if (key !== undefined && value !== undefined) {
                            param_dict[key.trim()] = value.trim();
                        }
                    }
                }
            } else {
                // 单个参数： key=value
                const [key, value] = parameters.split('=', 1);
                if (key !== undefined && value !== undefined) {
                    param_dict[key.trim()] = value.trim();
                }
            }
        } else {
            // 直接传入参数，根据工具类型智能推断
            if (tool_name === 'search') {
                param_dict = { query: parameters };
            } else if (tool_name === 'memory') {
                param_dict = { action: 'search', query: parameters };
            } else {
                param_dict = { input: parameters };
            }
        }

        return param_dict;
    }

     stream_run(input_text: string, kwargs): Iterator<string> {
        """
        自定义的流式运行方法
        """
        console.log(`🌊 ${this.name} 开始流式处理: ${input_text}`)

        let messages: Record<string, string>[] = []

        if (this.system_prompt) {
            messages.push({"role": "system", "content": this.system_prompt})
        }

        for (const msg of this._history) {
            messages.push({"role": msg.role, "content": msg.content})
        }

        messages.push({"role": "user", "content": input_text})

        // 流式调用LLM
        let full_response = ""
        console.log("📝 实时响应: ", end="")
        for (const chunk of this.llm.stream_invoke(messages, kwargs)) {
            full_response += chunk
            console.log(chunk, end="", flush=True)
            yield chunk
        }

        console.log()  // 换行

        // 保存完整对话到历史记录
        this.add_message(new Message(input_text, "user"))
        this.add_message(new Message(full_response, "assistant"))
        console.log(`✅ ${this.name} 流式响应完成`)
    }

    /**
     * 添加工具到Agent（便利方法）
     * @param tool Tool对象
     * @param auto_expand 是否自动展开可展开的工具（默认true）
     */
    async add_tool(tool: Tool, auto_expand: boolean = true): Promise<void> {
        if (!this.tool_registry) {
            this.tool_registry = new (await import("../tools/registry.js")).ToolRegistry()
            this.enable_tool_calling = true
        }

        // 直接使用 ToolRegistry 的 register_tool 方法
        // ToolRegistry 会自动处理工具展开
        this.tool_registry.register_tool(tool, auto_expand)
        console.log(`🔧 工具 '${tool.name}' 已添加`)
    }

    /**
   * 检查是否有可用工具
   * @returns 是否有可用工具
   */
    hasTools(): boolean {
        return this.enable_tool_calling && !!this.tool_registry;
    }

    /**
     * 移除工具（便利方法）
     * @param toolName 要移除的工具名称
     * @returns 是否移除成功
     */
    removeTool(toolName: string): boolean {
        if (this.tool_registry) {
            this.tool_registry.unregister_tool(toolName);
            return true;
        }
        return false;
    }

    /**
     * 列出所有可用工具
     * @returns 工具名称列表
     */
    listTools(): string[] {
        if (this.tool_registry) {
            return this.tool_registry.list_tools();
        }
        return [];
    }
}