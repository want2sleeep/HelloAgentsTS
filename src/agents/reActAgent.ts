import Agent from "../core/agent.js";
import type Config from "../core/config.js";
import type HelloAgentsLLM from "../core/llm.js";
import { ToolRegistry } from "../tools/registry.js";
import DEFAULT_PROMPT from "../prompts/reActAgent.js";
import { Tool } from "../tools/index.js";
import type { ChatCompletionMessageParam } from "openai/resources";
import Message from "../core/message.js";

/**
 * ReAct (Reasoning and Acting) Agent
 *   
 *  结合推理和行动的智能体，能够：
 *  1. 分析问题并制定行动计划
 *  2. 调用外部工具获取信息
 *  3. 基于观察结果进行推理
 *  4. 迭代执行直到得出最终答案
 *    
 *  这是一个经典的Agent范式，特别适合需要外部信息的任务。
 */
export class ReActAgent extends Agent {
    public toolRegistry: ToolRegistry;
    public maxStep: number;
    public promptTemplate: string;
    private currentHistory: string[] = [];

    /**
     * 初始化ReActAgent
     *
     * @param name Agent名称
     * @param llm LLM实例
     * @param systemPrompt 系统提示词
     * @param config 配置对象
     * @param toolRegistry 工具注册表（可选，如果不提供则创建空的工具注册表）
     * @param maxSteps 最大执行步数
     * @param customPrompt 自定义提示词模板
     */
    constructor({
        name,
        llm,
        systemPrompt,
        config,
        toolRegistry,
        maxStep = 5,
        customPrompt
    }: {
        name: string,
        llm: HelloAgentsLLM,
        systemPrompt?: string,
        config?: Config,
        toolRegistry?: ToolRegistry,
        maxStep: number,
        customPrompt?: string
    }) {
        super(name, llm, systemPrompt, config);

        if (!toolRegistry) {
            this.toolRegistry = new ToolRegistry();
        } else {
            this.toolRegistry = toolRegistry;
        }


        this.maxStep = maxStep;
        this.promptTemplate = customPrompt || DEFAULT_PROMPT;
    }

    /**
     * 添加工具到工具注册表
     * 支持 MCP 工具的自动展开
     * 
     * @param tool 工具实例（可以是普通工具和 MCP 工具）
     */
    addTool(tool: any): void {
        if ('autoExpand' in tool && tool.autoExpand) {
            if ('_availableTools' in tool && tool._availableTools) {
                for (const mcpTool of tool._availableTools) {
                    // 创建包装工具实例
                }

                // 输出提示信息（对应Python的print）
                console.log(`✅ MCP工具 '${tool.name}' 已展开为 ${tool._availableTools.length} 个独立工具`);
            }
            else {
                this.toolRegistry.registerTool(tool);
            }
        } else {
            this.toolRegistry.registerTool(tool)
        }
    }

    /**
     * 运行 ReActAgent
     *
     * @param inputText 用户问题
     * @param kwargs 其他参数
     * @returns 最终答案
     */
    async run({
        inputText,
        ...kwargs
    }: {
        inputText: string,
        [key: string]: any
    }): Promise<string> {
        this.currentHistory = [];
        let currentStep = 0;

        console.log(`\n🤖 ${this.name} 开始处理问题: ${inputText}`);

        while (currentStep < this.maxStep) {
            currentStep++;
            console.log(`\n--- 第 ${currentStep} 步 ---`);

            const toolsDesc = this.toolRegistry.getToolsDescription();
            const historyStr = this.currentHistory.join("\n");
            const prompt = this.promptTemplate
                .replace("${tools}", toolsDesc)
                .replace("${question}", inputText)
                .replace("${history}", historyStr);

            // 调用 LLM
            const messages = [{ role: "user", content: prompt }];
            const responseText = await this.llm.invoke(messages as ChatCompletionMessageParam[], kwargs);

            if (!responseText) {
                console.log("❌ 错误：LLM未能返回有效响应。");
                break;
            }

            // 解析输出
            const [thought, action] = this._parseOutput(responseText);

            if (thought) {
                console.log(`🤔 思考: ${thought}`);
            }

            if (!action) {
                console.log("⚠️ 警告：未能解析出有效的Action，流程终止。");
                break;
            }

            // 检查是否完成
            if (action.startsWith('Finish')) {
                const finalAnswer = this._parseActionInput(action);
                console.log(`🎉 最终答案: ${finalAnswer}`);

                // 保存到历史记录
                this.addMessage(new Message("user", inputText));
                this.addMessage(new Message("assistant", finalAnswer));

                return finalAnswer;
            }

            // 执行工具调用
            const [toolName, toolInput] = this._parseAction(action);
            if (!toolName || !toolInput) {
                this.currentHistory.push("Observation: 无效的Action格式，请检查。");
                continue;
            }

            console.log(`🎬 行动: ${toolName}[${toolInput}]`);

            // 调用工具
            const observation = this.toolRegistry.executeTool(toolName, toolInput);
            console.log(`👀 观察: ${observation}`);

            // 更新历史
            this.currentHistory.push(`Action: ${action}`);
            this.currentHistory.push(`Observation: ${observation}`);
        }
        console.log("⏰ 已达到最大步数，流程终止。");
        const finalAnswer = "抱歉，我无法在限定步数内完成这个任务。";

        // 保存到历史记录
        this.addMessage(new Message("user", inputText));
        this.addMessage(new Message("assistant", finalAnswer));

        return finalAnswer;
    }
    private _parseOutput(text: string): [string | null, string | null] {
        const thoughtMatch = text.match(/Thought: (.*)/);
        const actionMatch = text.match(/Action: (.*)/);

        const thought = thoughtMatch ? thoughtMatch[1]?.trim() ?? null : null;
        const action = actionMatch ? actionMatch[1]?.trim() ?? null : null;

        return [thought, action];
    }

    private _parseAction(actionText: string): [string | null, string | null] {
        const match = actionText.match(/(\w+)\[(.*)\]/);
        if (match) {
            return [match[1] ?? null, match[2] ?? null];
        }
        return [null, null];
    }

    private _parseActionInput(actionText: string): string {
        const match = actionText.match(/\w+\[(.*)\]/);
        return match ? (match[1] ?? "") : "";
    }
}
