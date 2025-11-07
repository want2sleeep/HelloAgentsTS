import type { MessageRole, MessageMeta } from "../types/message.js";

export default class Message {
    public content: string;
    public role: MessageRole;
    public timestamp: Date;
    public metadata: MessageMeta;

    constructor(content: string, role: MessageRole, timestamp?: Date, metadata?: MessageMeta) {
        this.content = content;
        this.role = role;
        this.timestamp = timestamp ?? new Date();
        this.metadata = metadata ?? {};
    }

    /**
     * 转换为 OpenAI API 兼容的字典格式
     * @returns 包含角色和内容的字典
     */
    toDict(): { role: MessageRole; content: string } {
        return {
            role: this.role,
            content: this.content,
        };
    }

    /**
     * 重写 toString() 方法，转换为字符串格式
     * @returns 包含角色和内容的字符串
     */
    toString(): string {
        return `[${this.role}] ${this.content}`;
    }
}
