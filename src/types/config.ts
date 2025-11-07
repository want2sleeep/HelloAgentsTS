export interface ConfigOptions {
    defaultModel?: string;
    defaultProvider?: string;
    temperature?: number;
    maxTokens?: number | null;
    debug?: boolean;
    logLevel?: string;
    maxHistoryLength?: number;
}
