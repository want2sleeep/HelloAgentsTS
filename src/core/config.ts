import type { ConfigOptions } from "../types/config.js";

export default class Config {
  // LLM 配置
  public defaultModel: string = "gpt-3.5-turbo";
  public defaultProvider: string = "openai";
  public temperature: number = 0.7;
  public maxTokens: number | null = null;

  // 系统配置
  public debug: boolean = false;
  public logLevel: string = "INFO";

  //其他配置
  public maxHistoryLength: number = 100;

  constructor(options?: ConfigOptions) {
    if (options) {
      this.defaultModel = options.defaultModel ?? this.defaultModel;
      this.defaultProvider = options.defaultProvider ?? this.defaultProvider;
      this.temperature = options.temperature ?? this.temperature;
      this.maxTokens = options.maxTokens ?? this.maxTokens;
      this.debug = options.debug ?? this.debug;
      this.logLevel = options.logLevel ?? this.logLevel;
      this.maxHistoryLength = options.maxHistoryLength ?? this.maxHistoryLength;
    }
  }

  /**
   * 从环境变量加载配置
   * @returns 配置实例
   */
  static fromEnv(): Config {
    return new Config({
      debug: process.env.DEBUG?.toLowerCase() === "true",
      logLevel: process.env.LOG_LEVEL || "INFO",
      temperature: process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : 0.7,
      maxTokens: process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS, 10) : null,
    });
  }

  /**
   * 转换为字典对象
   * @returns 包含所有配置项的字典
   */
  toDict(): ConfigOptions {
    return {
      defaultModel: this.defaultModel,
      defaultProvider: this.defaultProvider,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      debug: this.debug,
      logLevel: this.logLevel,
      maxHistoryLength: this.maxHistoryLength,
    };
  }
}
