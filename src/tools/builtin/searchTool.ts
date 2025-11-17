import { Tool, type ToolParameter } from "../base.js";

export default class SearchTool extends Tool {
    async run(parameters: Record<string, any>): Promise<string> {
        return ''
    }

    getParameters(): ToolParameter[] {
        return []
    }
}