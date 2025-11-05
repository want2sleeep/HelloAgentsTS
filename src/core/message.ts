// 消息系统 
export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface MessageMeta {
    [key: string]: any;
}

export class Message {
    content: string;
    role: MessageRole;
    timestamp: Date;
    metadata: MessageMeta;

    constructor(content: string, role: MessageRole, opts?: { timestamp?: Date; metadata?: MessageMeta }) {
        this.content = content;
        this.role = role;
        this.timestamp = opts?.timestamp ?? new Date();
        this.metadata = opts?.metadata ?? {};
    }

    /**
     * 转换为 OpenAI API 兼容的字典格式（最小字段）
     */
    toDict(): { role: MessageRole; content: string } {
        return {
            role: this.role,
            content: this.content,
        };
    }

    toString(): string {
        return `[${this.role}] ${this.content}`;
    }

    // 可选：从字面对象创建 Message 实例
    static fromDict(obj: { role: MessageRole; content: string; timestamp?: string | Date; metadata?: MessageMeta }): Message {
        const timestamp = obj.timestamp ? new Date(obj.timestamp) : new Date();
        const metadata = obj.metadata ?? {};
        return new Message(obj.content, obj.role, { timestamp, metadata });
    }
}