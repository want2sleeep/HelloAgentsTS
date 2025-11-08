import { version, author, email, description } from './version.js';

import HelloAgentsLLM from './core/llm.js';
import Config from './core/config.js';
import Message from './core/message.js';
import { HelloAgentsException } from './types/exceptions.js';

import { SimpleAgent } from './agents/simpleAgent.js';

import { ToolRegistry } from './tools/registry.js';

export {
  // 元数据
  version,
  author,
  email,
  description,

  // 核心组件
  HelloAgentsLLM,
  Config,
  Message,
  HelloAgentsException,

  // Agent 范式
  SimpleAgent,

  // 工具系统
  ToolRegistry,
};