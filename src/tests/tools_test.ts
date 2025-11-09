import { Tool, toolAction, TypeValidationError } from '../tools/base.js';

// 测试工具类继承
class BaseTool extends Tool {
    constructor() {
        super({
            name: "base_tool",
            description: "基础工具",
            expandable: true
        });
    }

    @toolAction("base_operation", "基础操作")
    _baseMethod(text: string): string {
        return `基础操作: ${text}`;
    }

    getParameters() {
        return [
            { name: 'text', type: 'string', description: '文本参数', required: true, default: undefined }
        ];
    }

    async run(parameters: Record<string, any>): Promise<string> {
        return '基础工具执行';
    }
}

class ExtendedTool extends BaseTool {
    constructor() {
        super();
    }

    @toolAction("extended_operation", "扩展操作")
    _extendedMethod(number: number): string {
        return `扩展操作: ${number}`;
    }

    @toolAction("override_operation", "重写操作")
    _overrideMethod(text: string, extra: string = "default"): string {
        return `重写的基础操作: ${text} - ${extra}`;
    }
}

// 测试继承链元数据合并
function testInheritanceMetadata(): boolean {
    console.log('=== 测试继承链元数据合并 ===');
    
    const extendedTool = new ExtendedTool();
    
    const expandedTools = extendedTool.getExpandedTools();
    
    if (expandedTools) {
        console.log('展开的工具列表:');
        expandedTools.forEach((tool: Tool) => {
            console.log(`- ${tool.name}: ${tool.description}`);
        });
        
        // 验证是否包含了父类和子类的工具方法
        const toolNames = expandedTools.map((t: Tool) => t.name);
        const hasBase = toolNames.includes('base_operation');
        const hasExtended = toolNames.includes('extended_operation');
        const hasOverride = toolNames.includes('override_operation');
        
        console.log(`工具名称列表: ${toolNames.join(', ')}`);
        console.log(`包含基础方法: ${hasBase}`);
        console.log(`包含扩展方法: ${hasExtended}`);
        console.log(`包含重写方法: ${hasOverride}`);
        
        return hasBase && hasExtended && hasOverride;
    } else {
        console.log('没有找到展开的工具');
        return false;
    }
}

// 测试参数类型校验
async function testParameterValidation(): Promise<boolean> {
    console.log('\n=== 测试参数类型校验 ===');
    
    const testTool = new ExtendedTool();
    
    const expandedTools = testTool.getExpandedTools();
    if (!expandedTools) {
        console.log('无法获取展开的工具');
        return false;
    }
    
    // 找到扩展方法工具
    const extendedTool = expandedTools.find((t: Tool) => t.name === 'extended_operation');
    if (!extendedTool) {
        console.log('未找到扩展操作工具');
        return false;
    }
    
    try {
        // 测试正确类型
        console.log('测试正确类型参数...');
        await extendedTool.run({ number: 42 });
        console.log('✓ 正确类型参数通过验证');
        
        // 测试错误类型
        console.log('测试错误类型参数...');
        await extendedTool.run({ number: "not_a_number" });
        console.log('✗ 错误类型参数应该被拒绝');
        return false;
    } catch (error) {
        if (error instanceof TypeValidationError) {
            console.log(`✓ 正确捕获类型错误: ${(error as TypeValidationError).message}`);
            return true;
        } else {
            console.log('✗ 捕获了非类型验证错误');
            return false;
        }
    }
}

async function testErrorHandling(): Promise<boolean> {
    console.log('\n=== 测试异常处理 ===');
    
    class ErrorTestTool extends Tool {
        constructor() {
            super({
                name: "error_test",
                description: "错误测试工具",
                expandable: true
            });
        }

        @toolAction("error_operation", "错误操作")
        _errorMethod(): string {
            throw new Error("测试错误");
        }

        getParameters() {
            return [];
        }

        async run(parameters: Record<string, any>): Promise<string> {
            return '不会执行到这里';
        }
    }
    
    const errorTool = new ErrorTestTool();
    
    const expandedTools = errorTool.getExpandedTools();
    if (!expandedTools) {
        console.log('无法获取展开的工具');
        return false;
    }
    
    const errorOperationTool = expandedTools[0];
    
    if (!errorOperationTool) {
        console.log('✗ 未找到错误操作工具');
        return false;
    }
    
    try {
        console.log('测试工具执行异常...');
        const result = await errorOperationTool.run({});
        console.log(`结果: ${result}`);
        
        // 检查是否返回了友好的错误信息
        const hasFriendlyMessage = result.includes('工具执行失败') && result.includes('测试错误');
        console.log(`✓ 友好错误信息: ${hasFriendlyMessage}`);
        return hasFriendlyMessage;
    } catch (error) {
        console.log(`✗ 异常未正确处理: ${error}`);
        return false;
    }
}

async function runAllTests(): Promise<boolean> {
    console.log('开始测试工具优化功能...\n');
    
    const results: boolean[] = [
        testInheritanceMetadata(),
        await testParameterValidation(),
        await testErrorHandling()
    ];
    
    const passedTests = results.filter(Boolean).length;
    const totalTests = results.length;
    
    console.log(`\n=== 测试结果 ===`);
    console.log(`通过: ${passedTests}/${totalTests}`);
    console.log(`结果: ${passedTests === totalTests ? '全部通过 ✓' : '部分失败 ✗'}`);
    
    return passedTests === totalTests;
}

// 执行测试
runAllTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});