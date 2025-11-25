import type { Tool } from "./base.js";

/**
 * HelloAgents工具注册表
 *
 * 提供工具的注册、管理和执行功能。
 * 支持两种工具注册方式：
 * 1. Tool对象注册（推荐）
 * 2. 函数直接注册（简便）
 */
export class ToolRegistry {
    private _tools: Map<string, Tool> = new Map();
    _functions: Map<string, { description: string; func: any }> = new Map();

    /**
     * 注册 Tool 对象
     * 
     * @param tool Tool 实例
     * @param autoExpand 是否自动展开可展开的工具（默认True）
     */
    registerTool(tool: Tool, autoExpand: boolean = true): void {
        // 检查工具是否可展开
        if (autoExpand && 'expandable' in tool && tool.expandable) {
            const expandedTools = tool.getExpandedTools();
            if (expandedTools && expandedTools.length > 0) {
                for (const subTool of expandedTools) {
                    if (this._tools.has(subTool.name)) {
                        console.log(`⚠️ 警告：工具 '${subTool.name}' 已存在，将被覆盖。`);
                    }
                    this._tools.set(subTool.name, subTool);
                }
                console.log(`✅ 工具 '${tool.name}' 已展开为 ${expandedTools.length} 个独立工具`);
                return;
            }
        }

        // 普通工具或不展开的工具
        if (this._tools.has(tool.name)) {
            console.log(`⚠️ 警告：工具 '${tool.name}' 已存在，将被覆盖。`);
        }

        this._tools.set(tool.name, tool);
        console.log(`✅ 工具 '${tool.name}' 已注册。`);
        return;
    }

    /**
     * 直接注册函数作为工具（简便方式）
     * 
     * @param name 工具名称
     * @param description 工具描述
     * @param func 工具函数，接受字符串参数，返回字符串结果
     */
    registerFunction(name: string, description: string, func: (...args: string[]) => string): void {
        if (this._functions.has(name)) {
            console.log(`⚠️ 警告：工具 '${name}' 已存在，将被覆盖。`);
        }

        this._functions.set(name, { description, func });
        console.log(`✅ 工具 '${name}' 已注册。`);
    }

    /**
     * 注销工具
     * 
     * @param name 工具名称
     */
    unregisterTool(name: string): void {
        if (this._tools.has(name)) {
            this._tools.delete(name);
            console.log(`✅ 工具 '${name}' 已注销。`);
        } else if (this._functions.has(name)) {
            this._functions.delete(name);
            console.log(`✅ 工具 '${name}' 已注销。`);
        } else {
            console.log(`⚠️ 工具 '${name}' 不存在。`);
        }
    }

    /**
     * 获取 Tool 对象
     * 
     * @param name 工具名称
     * @returns 工具对象或undefined（如果不存在）
     */
    getTool(name: string): Tool | undefined {
        return this._tools.get(name);
    }

    /**
     * 获取工具函数
     * 
     * @param name 工具名称
     * @returns 工具函数或undefined（如果不存在）
     */
    getFunction(name: string): ((...args: string[]) => string) | undefined {
        return this._functions.get(name)?.func;
    }

    /**
     * 执行工具
     * 
     * @param name 工具名称
     * @param inputText 输入参数
     * @returns 执行结果
     */
    async executeTool(name: string, inputText: string): Promise<string> {
        if (this._tools.has(name)) {
            const tool = this._tools.get(name);
            try {
                return await tool?.run({ input: inputText }) || "";
            } catch (error) {
                return`❌ 执行工具 '${name}' 时发生异常: ${error}`;
            }
        } else if (this._functions.has(name)) {
            const func = this._functions.get(name)?.func;
            try {
                return func ? func(inputText) : "";
            } catch (error) {
                return `❌ 执行工具 '${name}' 时发生异常: ${error}`;
            }
        } else {
            return `❌ 工具 '${name}' 不存在。`;
        }
    }

    /**
     * 获取所有可用工具的格式化描述字符串
     * 
     * @returns 工具描述字符串，用于构建提示词
     */
    getToolsDescription(): string {
        const descriptions: string[] = [];

        // Tool对象描述
        for (const tool of this._tools.values()) {
            descriptions.push(`- ${tool.name}: ${tool.description}`);
        }

        // 函数工具描述
        for (const [name, info] of this._functions.entries()) {
            descriptions.push(`- ${name}: ${info.description}`);
        }

        return descriptions.length > 0 ? descriptions.join("\n") : "暂无可用工具";
    }

    /**
     * 获取所有工具的名称
     * 
     * @returns 工具名称数组
     */
    listTools(): string[] {
        return [...this._tools.keys(), ...this._functions.keys()];
    }

    /**
     * 获取所有Tool对象
     * 
     * @returns Tool对象数组
     */
    getAllTools(): Tool[] {
        return [...this._tools.values()];
    }

    /**
     * 清空所有注册的工具和函数
     */
    clear(): void {
        this._tools.clear();
        this._functions.clear();
        console.log("🧹 所有工具已清空。");
    }
}

export const globalRegistry = new ToolRegistry();
