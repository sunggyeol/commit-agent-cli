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

interface CommitPreferences {
    useConventionalCommits: boolean;
    commitMessageStyle: 'concise' | 'descriptive';
}

export async function generateCommitMessage(diff: string, preferences: CommitPreferences) {
    const conventionalGuide = preferences.useConventionalCommits
        ? 'Use conventional commit format with prefixes like feat:, fix:, chore:, docs:, style:, refactor:, test:, etc.'
        : 'Do NOT use conventional commit prefixes. Write natural commit messages.';

    const styleGuide = preferences.commitMessageStyle === 'descriptive'
        ? 'Be descriptive and detailed. Explain the "why" behind changes when relevant. Multi-line messages are encouraged.'
        : 'Be concise and to the point. Keep it short, ideally one line.';

    const systemPrompt = `You are an expert developer. Your task is to generate a commit message for the provided git diff.

Available Tools (use SPARINGLY - only when absolutely necessary):
- git_commit_history: Check last 3-5 commits to understand conventions (use ONLY if diff is ambiguous)
- git_staged_files: See list of staged files (use ONLY if you need to understand scope)
- read_file: Read a file (ONLY if diff references unclear code - read MAX 1-2 files, prefer small files)
- list_dir: List directory contents (RARELY needed)

EFFICIENCY RULES - CRITICAL:
1. The diff contains ALL the information you need in 90% of cases. START by analyzing it thoroughly.
2. DO NOT automatically call tools. Only use them if the diff is genuinely unclear.
3. If using read_file, read ONLY the specific function/class mentioned, not entire files.
4. NEVER read more than 2 files total.
5. If checking commit history, limit to 3-5 recent commits maximum.
6. DO NOT use list_dir unless absolutely critical to understand project structure.

Commit Message Rules:
1. ${conventionalGuide}
2. ${styleGuide}
3. Focus on WHAT changed and WHY (if clear from diff).
4. OUTPUT FORMAT: Your response must be ONLY the commit message. No explanations, no "Here is...", no analysis.
5. Do NOT use markdown code blocks or formatting.
6. If multi-line, use proper git commit format (subject line, blank line, body).

CRITICAL: Your ENTIRE response should be the commit message itself, nothing else. No preamble, no explanation.

REMEMBER: The diff is your primary source. Tools are for edge cases only.
`;

    const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Generate a commit message for this diff:\n\n${diff}`),
    ];

    const graph = getApp();
    const result = await graph.invoke({ messages });
    const lastMsg = result.messages[result.messages.length - 1];
    let content = lastMsg.content as string;

    // Post-process to extract just the commit message
    content = content.trim();

    // Remove common LLM prefixes and markdown
    const patterns = [
        /^(?:Here is|Here's|Based on|Looking at|This is|The commit message is|Commit message).*?:\s*/i,
        /^```[\w]*\n?/,  // Remove opening markdown code blocks
        /\n?```$/,       // Remove closing markdown code blocks
    ];

    for (const pattern of patterns) {
        content = content.replace(pattern, '');
    }

    // If response has explanation before commit message, try to extract just the message
    const lines = content.split('\n');
    if (lines.length > 3 && preferences.useConventionalCommits) {
        const commitPrefixes = ['feat:', 'fix:', 'chore:', 'docs:', 'style:', 'refactor:', 'test:', 'perf:', 'ci:', 'build:', 'revert:'];
        const commitLineIndex = lines.findIndex(line =>
            commitPrefixes.some(prefix => line.trim().toLowerCase().startsWith(prefix))
        );

        if (commitLineIndex > 0) {
            content = lines.slice(commitLineIndex).join('\n').trim();
        }
    }

    return content.trim();
}
