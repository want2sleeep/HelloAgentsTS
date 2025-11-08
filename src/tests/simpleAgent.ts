import 'dotenv/config'
import { SimpleAgent } from "../agents/simpleAgent.js";
import HelloAgentsLLM from "../core/llm.js";

const llm = new HelloAgentsLLM()
const agent = new SimpleAgent({
    name: "SimpleAgent",
    llm,
    systemPrompt: "你是一个简单的智能体，只能回答简单的问题。",
})
const testInputs = [
    "你好，请介绍一下自己",
    "什么是人工智能？",
    "请用一句话总结机器学习的核心思想"
]

for (const inputText of testInputs) {
    console.log(`Input: ${inputText}`)
    try {
        const response = await agent.run({ inputText })
        console.log(`Response: ${response}\n\n\n`)
    } catch (error) {
        console.error(`Error: ${error}`)
    }
}
