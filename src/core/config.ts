// 配置管理 - TypeScript 实现
/**
 * HelloAgents 配置类
 * - 提供默认值
 * - 支持从环境变量生成配置
 */
export interface ConfigShape {
  default_model: string;
  default_provider: string;
  temperature: number;
  max_tokens?: number | null;
  debug: boolean;
  log_level: string;
  max_history_length: number;
}

export class Config implements ConfigShape {
  default_model = "gpt-3.5-turbo";
  default_provider = "openai";
  temperature = 0.7;
  max_tokens: number | null = null;

  debug = false;
  log_level = "INFO";

  max_history_length = 100;

  constructor(init?: Partial<ConfigShape>) {
    if (!init) return;
    if (init.default_model !== undefined) this.default_model = init.default_model;
    if (init.default_provider !== undefined) this.default_provider = init.default_provider;
    if (init.temperature !== undefined) this.temperature = init.temperature;
    if (init.max_tokens !== undefined) this.max_tokens = init.max_tokens;
    if (init.debug !== undefined) this.debug = init.debug;
    if (init.log_level !== undefined) this.log_level = init.log_level;
    if (init.max_history_length !== undefined) this.max_history_length = init.max_history_length;
  }

  /**
   * 从环境变量创建配置
   * 支持的环境变量：DEBUG, LOG_LEVEL, TEMPERATURE, MAX_TOKENS, DEFAULT_MODEL, DEFAULT_PROVIDER, MAX_HISTORY_LENGTH
   */
  static fromEnv(): Config {
    const cfg = new Config();
    const e = process.env;
    if (e.DEBUG !== undefined) cfg.debug = String(e.DEBUG).toLowerCase() === "true";
    if (e.LOG_LEVEL !== undefined) cfg.log_level = e.LOG_LEVEL;
    if (e.TEMPERATURE !== undefined) cfg.temperature = parseFloat(e.TEMPERATURE);
    if (e.MAX_TOKENS !== undefined) {
      const n = parseInt(e.MAX_TOKENS, 10);
      cfg.max_tokens = Number.isNaN(n) ? null : n;
    }
    if (e.DEFAULT_MODEL !== undefined) cfg.default_model = e.DEFAULT_MODEL;
    if (e.DEFAULT_PROVIDER !== undefined) cfg.default_provider = e.DEFAULT_PROVIDER;
    if (e.MAX_HISTORY_LENGTH !== undefined) {
      const n = parseInt(e.MAX_HISTORY_LENGTH, 10);
      if (!Number.isNaN(n)) cfg.max_history_length = n;
    }
    return cfg;
  }

  /** 转换为普通字典对象 */
  toDict(): ConfigShape {
    return {
      default_model: this.default_model,
      default_provider: this.default_provider,
      temperature: this.temperature,
      max_tokens: this.max_tokens,
      debug: this.debug,
      log_level: this.log_level,
      max_history_length: this.max_history_length,
    };
  }
}

export default Config;
