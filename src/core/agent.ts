import { Message } from './message.js';
import { HelloAgentsLLM } from './llm.js';
import Config from './config.js';

/**
 * Agent 基类（TypeScript 实现）
 * - name: Agent 名称
 * - llm: HelloAgentsLLM 实例
 * - systemPrompt: 可选的系统提示
 * - config: 可选的配置
 */
export abstract class Agent {
  public name: string;
  public llm: HelloAgentsLLM;
  public systemPrompt?: string | undefined;
  public config: Config;

  protected _history: Message[] = [];

  constructor(name: string, llm: HelloAgentsLLM, systemPrompt?: string, config?: Config) {
    this.name = name;
    this.llm = llm;
    this.systemPrompt = systemPrompt;
    this.config = config ?? new Config();
    this._history = [];
  }

  /**
   * 运行 agent 的核心方法，子类必须实现。
   * 返回 Promise<string> 以便支持异步调用（例如调用远程 LLM）。
   */
  abstract run(inputText: string, kwargs?: Record<string, any>): Promise<string>;

  addMessage(message: Message): void {
    this._history.push(message);
  }

  clearHistory(): void {
    this._history = [];
  }

  getHistory(): Message[] {
    return [...this._history];
  }

  toString(): string {
    // llm.provider 在某些实现中可能为私有，使用 any 安全地读取（仅用于展示）
    const provider = (this.llm as any)?.provider ?? '';
    return `Agent(name=${this.name}, provider=${provider})`;
  }

  // 与 Python 的 __repr__ 保持一致
  toJSON(): string {
    return this.toString();
  }
}

export default Agent;
