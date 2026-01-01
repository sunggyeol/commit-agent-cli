import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tools } from './tools.js';

// Lazily initialize the graph so we can pick up the API key if set via CLI input
let app: any = null;

function getApp() {
    if (app) return app;

    // Define the model
    const model = new ChatAnthropic({
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0,
        // It will automatically look for ANTHROPIC_API_KEY in process.env if not provided,
        // but explicit assignment ensures it picks up dynamic changes if any.
        apiKey: process.env.ANTHROPIC_API_KEY,
    }).bindTools(tools);

    // Define the tools node
    const toolNode = new ToolNode(tools);

    // Define the agent node
    async function agent(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const result = await model.invoke(messages);
        return { messages: [result] };
    }

    // Define conditional logic
    function shouldContinue(state: typeof MessagesAnnotation.State) {
        const lastMessage = state.messages[state.messages.length - 1];
        // If the last message has tool calls, continue to tools
        if (lastMessage.additional_kwargs.tool_calls || (lastMessage as any).tool_calls?.length > 0) {
            return 'tools';
        }
        return '__end__';
    }

    // Create the graph
    const workflow = new StateGraph(MessagesAnnotation)
        .addNode('agent', agent)
        .addNode('tools', toolNode)
        .addEdge('__start__', 'agent')
        .addConditionalEdges('agent', shouldContinue)
        .addEdge('tools', 'agent');

    app = workflow.compile();
    return app;
}

export async function generateCommitMessage(diff: string) {
    const systemPrompt = `You are an expert developer. Your task is to generate a conventional commit message for the provided git diff.
  
Rules:
1. Analyze the diff carefully.
2. If the diff is ambiguous or references code/files you don't see in the diff but need context for, use the 'read_file' or 'list_dir' tools to explore the codebase.
3. Keep the commit message concise and following standard conventional commits (e.g., "feat: ...", "fix: ...").
4. Do NOT output anything else (like "Here is the commit message:"). Just the commit message itself.
`;

    const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Here is the git diff:\n\n${diff}`),
    ];

    const graph = getApp();
    const result = await graph.invoke({ messages });
    const lastMsg = result.messages[result.messages.length - 1];
    return lastMsg.content;
}
