import type { ChatCompletionMessageParam } from "openai/resources";
import Agent from "../core/agent.js";
import type HelloAgentsLLM from "../core/llm.js";
import Message from "../core/message.js";
import DEFAULT_PROMPTS from "../prompts/reflectionAgent.js";

/**
 * 简单的短期记忆模块，用于存储智能体的行动与反思轨迹。
 */
class Memory {
    records: Record<string, any>[] = [];

    constructor() { }

    /**
     * 添加一条新的记忆记录。
     * @param record 记忆记录对象
     */
    addRecord(recordType: string, content: string): void {
        this.records.push({ type: recordType, content });
        console.log(`📝 记忆已更新，新增一条 '${recordType}' 记录。内容：${content}`);
    }

    /**
     * 将所有记忆记录格式化为一个连贯的字符串文本
     * @return 格式化后的记忆文本
     */
    getTrajectory(): string {
        let trajectory = '';
        for (const record of this.records) {
            if (record.type === 'execution') {
                trajectory += `--- 上一轮尝试 (代码) ---\n${record.content}\n\n`;
            } else if (record.type === 'reflection') {
                trajectory += `--- 评审员反馈 ---\n${record.content}\n\n`
            };
        }
        return trajectory.trim();
    }

    /**
     * 获取最近一次的执行记录
     * @return 最近一次执行的内容
     */
    getLastExecution(): string {
        for (let i = this.records.length - 1; i >= 0; i--) {
            const record = this.records[i];
            if (record && record.type === 'execution') {
                return record.content;
            }
        }
        return "";
    }
}

/**
 * Reflection Agent - 自我反思与迭代优化的智能体
 * 
 * 这个Agent能够：
 * 1. 执行初始任务
 * 2. 对结果进行自我反思
 * 3. 根据反思结果进行优化
 * 4. 迭代改进直到满意
 * 
 * 特别适合代码生成、文档写作、分析报告等需要迭代优化的任务。
 * 
 * 支持多种专业领域的提示词模板，用户可以自定义或使用内置模板。
 */
export default class ReflectionAgent extends Agent {
    maxIterations: number;
    prompts: Record<string, string>;
    memory: Memory;

    /**
     * 初始化ReflectionAgent
     *
     * @param options.name - Agent名称
     * @param options.llm - LLM实例
     * @param options.systemPrompt - 系统提示词（可选）
     * @param options.config - 配置对象（可选）
     * @param options.maxIterations - 最大迭代次数，默认为3
     * @param options.customPrompts - 自定义提示词模板，格式为 {"initial": "", "reflect": "", "refine": ""}（可选）
     */
    constructor({
        name,
        llm,
        systemPrompt,
        config,
        maxIterations = 3,
        customPrompts = {}
    }: {
        name: string;
        llm: HelloAgentsLLM,
        systemPrompt?: string;
        config?: any;
        maxIterations?: number;
        customPrompts?: Record<string, string>;
    }) {
        super(name, llm, systemPrompt, config);
        this.maxIterations = maxIterations;
        this.memory = new Memory();

        // 设置提示词模板：用户自定义优先，否则使用默认模板
        this.prompts = customPrompts ?? DEFAULT_PROMPTS;
    }

    /**
     * 运行ReflectionAgent的核心方法
     *
     * @param inputText 任务描述
     * @param kwargs 其他参数
     * @returns 最终优化后的结果
     */
    async run({
        inputText,
        ...kwargs
    }: {
        inputText: string,
        [key: string]: any
    }): Promise<string> {
        console.log(`\n🤖 ${this.name} 开始处理任务: ${inputText}`);

        // 重置记忆
        this.memory = new Memory();

        // 1. 初始执行
        console.log("\n--- 正在进行初始尝试 ---");
        const initialPrompt = (this.prompts["initial"] || DEFAULT_PROMPTS["initial"]).replace("{task}", inputText);
        const initialResult = await this._getLLMResponse(initialPrompt, kwargs);
        this.memory.addRecord("execution", initialResult);

        // 2. 迭代循环：反思与优化
        for (let i = 0; i < this.maxIterations; i++) {
            console.log(`\n--- 第 ${i+1}/${this.maxIterations} 轮迭代 ---`);

            // a. 反思
            console.log("\n-> 正在进行反思...");
            const lastResult = this.memory.getLastExecution();
            const reflectPrompt = (this.prompts["reflect"] || DEFAULT_PROMPTS["reflect"])
                .replace("{task}", inputText)
                .replace("{content}", lastResult);
            const feedback = await this._getLLMResponse(reflectPrompt, kwargs);
            this.memory.addRecord("reflection", feedback);

            // b. 检查是否需要停止
            if (feedback.includes("无需改进") || feedback.toLowerCase().includes("no need for improvement")) {
                console.log("\n✅ 反思认为结果已无需改进，任务完成。");
                break;
            }

            // c. 优化
            console.log("\n-> 正在进行优化...");
            const refinePrompt = (this.prompts["refine"] || DEFAULT_PROMPTS["refine"])
                .replace("{task}", inputText)
                .replace("{lastAttempt}", lastResult)
                .replace("{feedback}", feedback);
            const refinedResult = await this._getLLMResponse(refinePrompt, kwargs);
            this.memory.addRecord("execution", refinedResult);
        }

        const finalResult = this.memory.getLastExecution();
        console.log(`\n--- 任务完成 ---\n最终结果:\n${finalResult}`);

        // 保存到历史记录
        this.addMessage(new Message("user", inputText));
        this.addMessage(new Message("assistant", finalResult));

        return finalResult;
    }

    /** 调用LLM并获取完整响应 */
    private async _getLLMResponse(prompt: string, kwargs: any): Promise<string> {
        const messages = [{ role: "user", content: prompt }] as ChatCompletionMessageParam[];
        return await this.llm.invoke(messages, kwargs) || "";
    }
}
