import HelloAgentsLLM from "./llm.js";
import Config from "./config.js";
import Message from "./message.js";

/**
 * Agent 基类
 * - name: Agent 名称
 * - llm: HelloAgentsLLM 实例
 * - systemPrompt: 可选的系统提示
 * - config: 可选的配置
 */
export default abstract class Agent {
    public name: string;
    public llm: HelloAgentsLLM;
    public systemPrompt: string | null;
    public config: Config | null;
    protected _history: Message[] = [];

    constructor(
        name: string,
        llm: HelloAgentsLLM,
        systemPrompt: string | null = null,
        config: Config | null = null
    ) {
        this.name = name;
        this.llm = llm;
        this.systemPrompt = systemPrompt;
        this.config = config ?? new Config();
    }

    /**
     * 运行 agent 的核心方法，子类必须实现。
     * 返回 Promise<string> 以便支持异步调用（例如调用远程 LLM）。
     */
    abstract run({
        inputText,
        ...kwargs
    }: {
        inputText: string,
        [key: string]: any
    }): Promise<string>;

    /**
     * 向历史记录中添加一条消息
     * @param message 要添加的消息对象
     */
    addMessage(message: Message): void {
        this._history.push(message);
    }

    /**
     * 清空历史记录
     */
    clearHistory(): void {
        this._history = [];
    }

    /**
     * 获取当前历史记录的副本
     * @returns 历史记录的数组副本
     */
    getHistory(): Message[] {
        return Array.from(this._history);
    }

    /**
     * 重写 toString() 方法，转换为字符串格式
     * @returns 包含角色和 LLM 提供商的字符串
     */
    toString(): string {
        return `Agent(name=${this.name}, provider=${this.llm.provider})`;
    }
}
