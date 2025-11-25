export default class AST {
    static literalEval (str: string): any {
        try {
            // 处理LLM可能输出的尾逗号（如["步骤1", "步骤2",]）
            const fixedStr = str.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
            return JSON.parse(fixedStr); // TS数组语法和JSON数组兼容，可直接用JSON.parse
        } catch (e) {
            throw new Error(`解析数组失败: ${(e as Error).message}`);
        }
    }
}
