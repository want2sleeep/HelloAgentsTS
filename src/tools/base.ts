/**
 * 装饰器：标记一个方法为可展开的工具 action
 *
 * 用法:
 *     @tool_action("memory_add", "添加新记忆")
 *     _add_memory(self, content: string, importance: number = 0.5): string {
 *         // 添加记忆
 *         // content: 记忆内容
 *         // importance: 重要性分数
 *     }
 *
 * @param name 工具名称（如果不提供，从方法名自动生成）
 * @param description 工具描述（如果不提供，从 docstring 提取）
 */
export function tool_action(name?: string, description?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        (originalMethod as any)._is_tool_action = true;
        (originalMethod as any)._tool_name = name;
        (originalMethod as any)._tool_description = description;
        return descriptor;
    };
}

export abstract class Tool {
    abstract run( parameters: Record<string, string>): Promise<string>;
        // """执行工具"""
}
