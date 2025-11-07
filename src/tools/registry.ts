import type { Tool } from "./base.js";

export class ToolRegistry {
    register_tool(tool: Tool, auto_expand: boolean = true): void {}

    get_tools_description(): string {
        return "";
    }

    get_tool() {}

    execute_tool(): string {
        return "";
    }
}
