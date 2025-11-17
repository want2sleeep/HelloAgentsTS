 import { Tool, type ToolParameter } from "../base.js";

export default class CalculateTool extends Tool {
    private static readonly OPERATORS: Record<string, (a: number, b?: number) => number> = {
        '+': (a, b) => {
            if (b === undefined) throw new Error("'+'需要两个操作数");
            return a + b;
        },
        '-': (a, b) => {
            return b !== undefined ? a - b : -a
        },
        '*': (a, b) => {
            if (b === undefined) throw new Error("'*'需要两个操作数");
            return a * b;
        },
        '/': (a, b) => {
            if (b === undefined) throw new Error("'/'需要两个操作数");
            if (b === 0) throw new Error("除数不能为0");
            return a / b;
        },
        '**': (a, b) => {
            if (b === undefined) throw new Error("'**'需要两个操作数");
            return Math.pow(a, b);
        },
    };
    private static readonly FUNCTIONS: Record<string, Function> = {};

    constructor() {
        super({
            name: "ts_calculator",
            description: "执行数学计算。支持基本运算、数学函数等。例如：2+3*4, sqrt(16), sin(pi/2)等。"
        });
    }

    /**
     * 执行计算
     * 
     * @param parameters 包含 input 参数的字典
     * @returns 计算结果 
     */
    async run(parameters: Record<string, any>): Promise<string> {
        const expression = parameters.input || parameters.expression || ''

        if (!expression) {
            return "错误：计算表达式不能为空"
        }

        console.log(`🧮 正在计算: ${expression}`);

        return ''
    }

    getParameters(): ToolParameter[] {
        return []
    }
}