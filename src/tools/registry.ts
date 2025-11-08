import type { Tool } from "./base.js";

export class ToolRegistry {
    registerTool(tool: Tool, autoExpand: boolean = true): void {}

    registerFunction(name: string, description: string, callback: string): void {}

    unregisterTool(name: string): void {}

    getTool(name: string): Tool | null {
        return null;
    }

    getFunction (name: string) {
        return null;
    }

    executeTool(name: string, arguments_: string): string {
        return "";
    }


    getToolsDescription(): string {
        return "";
    }
    listTools(): string[] {
        return [];
    }

    getAllTools(): Tool[] {
        // 获取所有Tool对象
        return [];
    }

    clear(): void {
    }
}
