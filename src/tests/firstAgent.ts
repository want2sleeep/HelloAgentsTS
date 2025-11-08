import 'dotenv/config'

const AGENT_SYSTEM_PROMPT = `
你是一个智能旅行助手。你的任务是分析用户的请求，并使用可用工具一步步地解决问题。

# 可用工具:
- get_weather(city: string): 查询指定城市的实时天气。
- get_attraction(city: string, weather: string): 根据城市和天气搜索推荐的旅游景点。

# 行动格式:
你的回答必须严格遵循以下格式。首先是你的思考过程，然后是你要执行的具体行动，每次回复只输出一对Thought-Action：
Thought: [这里是你的思考过程和下一步计划]
Action: [这里是你要调用的工具，格式为 function_name(arg_name="arg_value")]

# 任务完成:
当你收集到足够的信息，能够回答用户的最终问题时，你必须在 Action: 字段后使用 finish(answer="...") 来输出最终答案。

请开始吧！`;

import axios from 'axios';

async function get_weather(city: string): Promise<string> {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    try {
        const res = await axios.get(url);
        const current = res.data.current_condition[0];
        const desc = current.weatherDesc[0].value;
        const temp = current.temp_C;
        return `${city}当前天气：${desc}，气温${temp}摄氏度`;
    } catch (e: any) {
        return `错误：查询天气时遇到网络问题 - ${e.message}`;
    }
}

import { TavilyClient } from 'tavily';

async function get_attraction(city: string, weather: string): Promise<string> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return '错误：未配置 TAVILY_API_KEY。';

    const client = new TavilyClient({ apiKey });
    const query = `'${city}' 在'${weather}'天气下最值得去的旅游景点推荐及理由`;

    try {
        const res = await client.search({
            query,
            search_depth: 'basic',
            include_answer: true,
        });
        if (res.answer) return res.answer;

        const lines = res.results?.map((r: any) => `- ${r.title}: ${r.content}`) || [];
        if (!lines.length) return '抱歉，没有找到相关的旅游景点推荐。';
        return '根据搜索，为您找到以下信息：\n' + lines.join('\n');
    } catch (e: any) {
        return `错误：执行Tavily搜索时出现问题 - ${e.message}`;
    }
}

const available_tools: Record<string, Function> = {
    get_weather,
    get_attraction,
};

import OpenAI from 'openai';

class OpenAICompatibleClient {
    private model: string;
    private client: OpenAI;

    constructor(model: string, apiKey: string, baseURL: string) {
        this.model = model;
        this.client = new OpenAI({ apiKey, baseURL });
    }

    async generate(prompt: string, systemPrompt: string): Promise<string> {
        console.log('正在调用大语言模型...');
        try {
            const res = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt },
                ],
                stream: false,
            });
            const ans = res.choices[0]?.message?.content ?? '';
            console.log('大语言模型响应成功。');
            return ans;
        } catch (e: any) {
            console.error(`调用LLM API时发生错误: ${e.message}`);
            return '错误：调用语言模型服务时出错。';
        }
    }
}

// --- 1. 配置LLM客户端 ---
const API_KEY = process.env.MODELSCOPE_API_KEY || 'YOUR_API_KEY';
const BASE_URL = process.env.LLM_BASE_URL || 'YOUR_BASE_URL';
const MODEL_ID = process.env.LLM_MODEL_ID || 'YOUR_MODEL_ID';
process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY || 'YOUR_TAVILY_API_KEY';

const llm = new OpenAICompatibleClient(MODEL_ID, API_KEY, BASE_URL);

// --- 2. 初始化 ---
const userPrompt = '你好，请帮我查询一下今天北京的天气，然后根据天气推荐一个合适的旅游景点。';
const promptHistory: string[] = [`用户请求: ${userPrompt}`];

console.log(`用户输入: ${userPrompt}\n${'='.repeat(40)}`);

// --- 3. 运行主循环 ---
(async () => {
    for (let i = 0; i < 5; i++) {
        console.log(`--- 循环 ${i + 1} ---\n`);

        // 3.1. 构建Prompt
        const fullPrompt = promptHistory.join('\n');

        // 3.2. 调用LLM进行思考
        let llmOutput = await llm.generate(fullPrompt, AGENT_SYSTEM_PROMPT);
        // 截断多余的 Thought-Action
        const m = llmOutput.match(/(Thought:.*?Action:.*?)(?=\n\s*(?:Thought:|Action:|Observation:)|\Z)/s);
        if (m && m[1] && m[1].trim() !== llmOutput.trim()) {
            llmOutput = m[1].trim();
            console.log('已截断多余的 Thought-Action 对');
        }
        console.log(`模型输出:\n${llmOutput}\n`);
        promptHistory.push(llmOutput);

        // 3.3. 解析并执行行动
        const actionMatch = llmOutput.match(/Action: (.*)/s);
        if (!actionMatch) {
            console.log('解析错误：模型输出中未找到 Action。');
            break;
        }
        const actionStr = actionMatch[1]?.trim() ?? '';

        if (actionStr.startsWith('finish')) {
            const finalMatch = actionStr.match(/finish\(answer="(.*)"\)/);
            if (finalMatch) {
                console.log(`任务完成，最终答案: ${finalMatch[1]}`);
                break;
            }
        }

        const toolMatch = actionStr.match(/(\w+)\(/);
        const argsMatch = actionStr.match(/\((.*)\)/s);
        if (!toolMatch || !argsMatch) {
            console.log('解析错误：无法提取工具名或参数。');
            break;
        }
        const toolName = toolMatch[1];
        const kwargs: Record<string, string> = {};
        argsMatch[1]?.replace(/(\w+)="([^"]*)"/g, (_, k, v) => (kwargs[k] = v));

        if (!toolName || !(toolName in available_tools)) {
            promptHistory.push(`Observation: 错误：未定义的工具 '${toolName}'`);
            console.log(`Observation: 错误：未定义的工具 '${toolName}'\n${'='.repeat(40)}`);
            continue;
        }

        // 修复：动态调用工具时仅传入所需参数
        const toolFn = available_tools[toolName] ?? (() => '错误：未定义的工具函数。');
        const observation = await (toolName === 'get_weather'
            ? toolFn(kwargs.city ?? '')
            : toolFn(kwargs.city ?? '', kwargs.weather ?? ''));
        const observationStr = `Observation: ${observation}`;
        console.log(`${observationStr}\n${'='.repeat(40)}`);
        promptHistory.push(observationStr);
    }
})();
