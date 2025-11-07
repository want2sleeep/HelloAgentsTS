/**
 * HelloAgents基础异常类，所有自定义异常的基类
 */
export class HelloAgentsException extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "HelloAgentsException";
        // 修复原型链指向，确保instanceof判断正常工作
        Object.setPrototypeOf(this, HelloAgentsException.prototype);
    }
}

/**
 * LLM（大语言模型）相关异常
 */
export class LLMException extends HelloAgentsException {
    constructor(message?: string) {
        super(message);
        this.name = "LLMException";
        Object.setPrototypeOf(this, LLMException.prototype);
    }
}

/**
 * Agent相关异常
 */
export class AgentException extends HelloAgentsException {
    constructor(message?: string) {
        super(message);
        this.name = "AgentException";
        Object.setPrototypeOf(this, AgentException.prototype);
    }
}

/**
 * 配置相关异常
 */
export class ConfigException extends HelloAgentsException {
    constructor(message?: string) {
        super(message);
        this.name = "ConfigException";
        Object.setPrototypeOf(this, ConfigException.prototype);
    }
}

/**
 * 工具相关异常
 */
export class ToolException extends HelloAgentsException {
    constructor(message?: string) {
        super(message);
        this.name = "ToolException";
        Object.setPrototypeOf(this, ToolException.prototype);
    }
}
