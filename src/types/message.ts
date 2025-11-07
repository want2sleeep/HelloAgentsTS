// 定义消息角色
export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageMeta = Record<string, any> | undefined;
