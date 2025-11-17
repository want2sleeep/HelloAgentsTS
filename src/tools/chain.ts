import type { ToolRegistry } from "./registry.js";

export class ToolChain {
    name: string;
    description: string;
    steps: Record<string, any>[] = [];

    constructor({
        name,
        description,
        steps
    }: {
        name: string,
        description: string,
        steps?: Record<string, any>[]
    }) {
        this.name = name;
        this.description = description;
        this.steps = steps || [];
    }

    /**
     *  添加工具执行步骤
     *  
     *  @param toolName: 工具名称
     *  @param inputTemplate: 输入模板，支持变量替换，如 "{input}" 或 "{searchResult}"
     *  @param outputKey: 输出结果的键名，用于后续步骤引用
     */
    addStep({
        toolName,
        inputTemplate,
        outputKey
    }: {
        toolName: string,
        inputTemplate: string,
        outputKey: string
    }): void {
        const step = {
            toolName: toolName,
            inputTemplate: inputTemplate,
            outputKey: outputKey || `step_${this.steps.length}_result`
        }
        this.steps.push(step)
        console.log(`✅ 工具链 '${this.name}' 添加步骤: ${toolName}`)
    }

    /**
     * 执行工具链
     *  
     * @param registry: 工具注册表
     * @param input_data: 初始输入数据
     * @param context: 执行上下文，用于变量替换
     * @returns 最终执行结果
    */
    async execute(registry: ToolRegistry, inputData: string, context: Record<string, any> = {}): Promise<string> {

        if (!this.steps) {
            return "❌ 工具链为空，无法执行";
        }

        console.log(`🚀 开始执行工具链: ${this.name}`);

        // 初始化上下文
        if (!context) {
            context = {};
        }
        context.input = inputData;

        let finalResult = inputData;
        let actualInput = '';

        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            const toolName = step?.toolName;
            const inputTemplate = step?.inputTemplate;
            const outputKey = step?.outputKey;

            console.log(`📝 执行步骤 ${i + 1}/${this.steps.length}: ${toolName}`);

            // 替换模板中的变量
            try {
                actualInput = this._formatTemplate(inputTemplate, context)
            } catch (error) {
                return `❌ 模板变量替换失败: ${error}`
            }

            // 执行工具
            try {
                const result = await registry.executeTool(toolName, actualInput)
                context[outputKey] = result
                finalResult = result
                console.log(`✅ 步骤 ${i + 1} 完成`)
            } catch (error) {
                return `❌ 工具 '${toolName}' 执行失败: ${error}`;
            }
        }

        console.log(`🎉 工具链 '${this.name}' 执行完成`);
        return finalResult;
    }

    /**
     * 字符串模板格式化
     * 
     * @param template 包含{key}占位符的模板字符串
     * @param context 上下文对象，键对应占位符的key，值为填充内容
     * @returns 填充后的字符串
     */
    private _formatTemplate(template: string, context: Record<string, string | number | boolean>): string {
        return template.replace(/{(\w+)}/g, (match, key) => context[key] !== undefined ? String(context[key]) : match);
    }
}

/**
 * 工具链管理器
 */
export class ToolChainManager {
    registry: ToolRegistry;
    chains: Map<string, ToolChain> = new Map();

    constructor(registry: ToolRegistry) {
        this.registry = registry;
    }

    /**
     * 注册工具链
     */
    registerChain(chain: ToolChain): void {
        this.chains.set(chain.name, chain);
        console.log(`✅ 工具链 '${chain.name}' 已注册`);
    }

    /**
     * 执行指定的工具链
     * 
     * @param chainName 
     * @param inputData 
     * @param context 
     */
    async executeChain(chainName: string, inputData: string, context: Record<string, any> = {}): Promise<string> {
        const chain = this.chains.get(chainName);
        if (!chain) {
            return `❌ 未找到名为 '${chainName}' 的工具链`;
        }

        return await chain.execute(this.registry, inputData, context);
    }

    /**
     * 列出所有已注册的工具链
     */
    listChains(): string[] {
        return Array.from(this.chains.keys());
    }

    /**
     * 获取工具链信息
     */
    getChainInfo(chainName: string): Record<string, any> | undefined {
        const chain = this.chains.get(chainName);

        if (!chain) {
            return chain;
        }

        return {
            name: chain.name,
            description: chain.description,
            steps: chain.steps.length,
            stepDetails: chain.steps.map((step) => ({
                toolName: step.toolName,
                inputTemplate: step.inputTemplate,
                outputKey: step.outputKey
            }))
        }
    }
}

/** 
 * 创建一个研究工具链：搜索 -> 计算 -> 总结
 */
export function createResearchChain(): ToolChain {
    const chain = new ToolChain({
        name: "research_and_calculate",
        description: "搜索信息并进行相关计算"
    });

    // 步骤1：搜索信息
    chain.addStep({
        toolName: "search",
        inputTemplate: "{input}",
        outputKey: "search_result"
    })

    // 步骤2：基于搜索结果进行计算
    chain.addStep({
        toolName: "my_calculator",
        inputTemplate: "2 + 2",  // 简单的计算示例
        outputKey: "calc_result"
    })

    return chain;
}

/**
 * 创建一个简单的工具链示例
 */
export function createSimpleChain(): ToolChain {
    const chain = new ToolChain({
        name: "simple_demo",
        description: "简单的工具链演示"
    })

    // 只包含一个计算步骤
    chain.addStep({
        toolName: "my_calculator",
        inputTemplate: "{input}",
        outputKey: "result"
    })

    return chain;
}
