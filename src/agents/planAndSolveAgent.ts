import type { ChatCompletionMessageParam } from "openai/resources";
import Agent from "../core/agent.js";
import type HelloAgentsLLM from "../core/llm.js";
import { DEFAULT_PLANNER_PROMPT, DEFAULT_EXECUTOR_PROMPT } from "../prompts/planAndSolveAgent.js";
import Message from "../core/message.js";
import AST from "../utils/ast.js";

/**
 * 规划器 - 负责将复杂问题分解为简单步骤
 */
class Planner {
    llmClient: HelloAgentsLLM;
    promptTemplate: string;

    constructor(llmClient: HelloAgentsLLM, promptTemplate?: string) {
        this.llmClient = llmClient;
        this.promptTemplate = promptTemplate ?? DEFAULT_PLANNER_PROMPT;
    }

    /**
     *  生成执行计划
     * 
     *  @param question 要解决的问题
     *  @param kwargs LLM调用参数
     *  @returns 步骤列表
    */
    async plan(question: string, kwargs: Record<string, any> = {}): Promise<string[]> {
        const prompt = this.promptTemplate.replace('{question}', question);
        const messages = [{ "role": "user", "content": prompt }] as ChatCompletionMessageParam[];

        console.log("--- 正在生成计划 ---")
        let responseText = await this.llmClient.invoke(messages, kwargs) || "";
        console.log(`✅ 计划已生成:\n${responseText}`);

        try {
            // 提取TypeScript代码块中的列表
            // 使用更精确的正则表达式，避免匹配到模板中的代码块
            const planMatch = responseText.match(/```typescript\s*\n?([\s\S]*?)\n?\s*```/);
            if (!planMatch || !planMatch[1]) {
                throw new Error("未找到有效的计划代码块");
            }

            const planStr = planMatch[1].trim();
            const plan = AST.literalEval(planStr);

            return Array.isArray(plan) && plan.every(i => typeof i === 'string') ? plan : [];
        } catch (error) {
            console.error(`❌ 解析计划时出错: ${(error as Error).message}`);
            console.log(`原始响应: ${responseText}`);
            return [];
        }
    }
}

class Executor {
    llmClient: HelloAgentsLLM;
    promptTemplate: string;

    constructor(llmClient: HelloAgentsLLM, promptTemplate?: string) {
        this.llmClient = llmClient;
        this.promptTemplate = promptTemplate ?? DEFAULT_EXECUTOR_PROMPT;
    }
    /**
     * 按计划执行任务
     *
     * @param question 原始问题
     * @param plan 执行计划
     * @param kwargs LLM 调用参数（以对象形式传入）
     *
     * @returns 最终答案
     */
    async execute(question: string, plan: string[], kwargs: Record<string, any> = {}): Promise<string> {
        let history = '';
        let finalAnswer = '';

        console.log("\n--- 正在执行计划 ---");
        for (let i = 0; i < plan.length; i++) {
            const currentStep = plan[i]!;
            const index = i + 1;

            console.log(`\n-> 正在执行步骤 ${index}/${plan.length}: ${currentStep}`);
            const prompt = this.promptTemplate
                .replace('{question}', question)
                .replace('{plan}', JSON.stringify(plan))
                .replace('{history}', history ? history : '无')
                .replace('{currentStep}', currentStep);

            const messages = [{ role: "user", content: prompt }] as ChatCompletionMessageParam[];

            // 调用 LLM 并传入额外参数，确保支持异步调用
            const responseText = (await this.llmClient.invoke(messages, kwargs)) || "";

            history += `步骤 ${index}: ${currentStep}\n结果: ${responseText}\n\n`;
            finalAnswer = responseText.trim();
            console.log(`✅ 步骤 ${index} 已完成，结果: ${finalAnswer}`);
        }

        return finalAnswer;
    }
}

/**
 *  Plan and Solve Agent - 分解规划与逐步执行的智能体
 *  
 *  这个Agent能够：
 *  1. 将复杂问题分解为简单步骤
 *  2. 按照计划逐步执行
 *  3. 维护执行历史和上下文
 *  4. 得出最终答案
 *  
 *  特别适合多步骤推理、数学问题、复杂分析等任务。
 */
export default class PlanAndSolveAgent extends Agent {
    planner: Planner;
    executor: Executor;

    constructor({
        name,
        llm,
        systemPrompt,
        config,
        customPrompts = {}
    }: {
        name: string;
        llm: HelloAgentsLLM,
        systemPrompt?: string;
        config?: any;
        customPrompts?: Record<string, string>;
    }) {
        super(name, llm, systemPrompt, config);

        let plannerPrompt;
        let executorPrompt;

        // 设置提示词模板：用户自定义有限，否则使用默认模板
        if (customPrompts) {
            plannerPrompt = customPrompts.planner;
            executorPrompt = customPrompts.executor;
        }

        this.planner = new Planner(llm, plannerPrompt);
        this.executor = new Executor(llm, executorPrompt);
    }

    async run({
        inputText,
        ...kwargs
    }: {
        inputText: string,
        [key: string]: any
    }): Promise<string> {
        console.log(`\n🤖 ${this.name} 开始处理问题: ${inputText}`);

        // 1. 生成计划
        const plan = await this.planner.plan(inputText, kwargs);
        if (!plan || plan.length === 0) {
            const finalAnswer = "无法生成有效的行动计划，任务终止。"
            console.log(`\n--- 任务终止 ---\n${finalAnswer}`);

            // 保存到历史记录
            this.addMessage(new Message('user', inputText));
            this.addMessage(new Message('assistant', finalAnswer));

            return finalAnswer;
        }

        // 2. 执行计划
        const finalAnswer = await this.executor.execute(inputText, plan, kwargs);
        console.log(`\n--- 任务完成 ---\n最终答案: ${finalAnswer}`);

        // 保存到历史记录
        this.addMessage(new Message('user', inputText));
        this.addMessage(new Message('assistant', finalAnswer));

        return finalAnswer;
    }
}
