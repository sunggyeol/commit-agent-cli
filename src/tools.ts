import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { execa } from 'execa';

// Helper to ensure we don't read outside of the project
const validatePath = (p: string) => {
  if (p.includes('..')) throw new Error('Cannot access parent directories');
  return p;
};

export const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    try {
      console.log(`  🔍 Agent is reading: ${filePath}`);

      // Check file size first
      const stats = await stat(validatePath(filePath));
      const MAX_SIZE = 50000; // 50KB limit

      if (stats.size > MAX_SIZE) {
        return `File ${filePath} is too large (${Math.round(stats.size / 1024)}KB). Please be more specific about what you need from this file, or ask about a smaller file.`;
      }

      const content = await readFile(validatePath(filePath), 'utf-8');

      // Truncate if still too long (safety check)
      const MAX_CHARS = 10000;
      if (content.length > MAX_CHARS) {
        return content.substring(0, MAX_CHARS) + `\n\n... [File truncated - ${content.length - MAX_CHARS} more characters]`;
      }

      return content;
    } catch (error: any) {
      return `Error reading file ${filePath}: ${error.message}`;
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file to understand code context. Limited to files under 50KB. Use sparingly.',
    schema: z.object({
      filePath: z.string().describe('The path to the file to read (relative to project root)'),
    }),
  }
);

export const listDirTool = tool(
  async ({ dirPath }: { dirPath: string }) => {
    try {
      console.log(`  📂 Agent is listing directory: ${dirPath}`);
      const files = await readdir(validatePath(dirPath));
      const result = await Promise.all(files.map(async (f) => {
        try {
          const s = await stat(join(dirPath, f));
          return `${f} ${s.isDirectory() ? '(DIR)' : '(FILE)'}`;
        } catch {
          return f;
        }
      }));
      return result.join('\n');
    } catch (error: any) {
      return `Error listing directory ${dirPath}: ${error.message}`;
    }
  },
  {
    name: 'list_dir',
    description: 'List files and directories in a given path.',
    schema: z.object({
      dirPath: z.string().describe('The directory path to list (relative to project root). defaults to "."'),
    }),
  }
);

export const gitCommitHistoryTool = tool(
  async ({ count }: { count: number }) => {
    try {
      const limitedCount = Math.min(count, 5); // Hard limit to 5 commits
      console.log(`  📜 Agent is checking last ${limitedCount} commits`);
      const { stdout } = await execa('git', ['log', `-n${limitedCount}`, '--pretty=format:%s'], { reject: false });
      return stdout || 'No commit history found';
    } catch (error: any) {
      return `Error getting commit history: ${error.message}`;
    }
  },
  {
    name: 'git_commit_history',
    description: 'Get recent commit messages to understand project conventions. Returns just the commit messages (no hashes/authors). Limited to 5 commits max.',
    schema: z.object({
      count: z.number().default(5).describe('Number of recent commits to retrieve (max: 5, default: 5)'),
    }),
  }
);

export const gitStagedFilesTool = tool(
  async () => {
    try {
      console.log(`  📋 Agent is listing staged files`);
      const { stdout } = await execa('git', ['diff', '--cached', '--name-status'], { reject: false });
      return stdout || 'No staged files';
    } catch (error: any) {
      return `Error getting staged files: ${error.message}`;
    }
  },
  {
    name: 'git_staged_files',
    description: 'List all staged files with their status (Added, Modified, Deleted).',
    schema: z.object({}),
  }
);

export const gitUnstagedFilesTool = tool(
  async () => {
    try {
      console.log(`  📝 Agent is listing unstaged files`);
      const { stdout } = await execa('git', ['diff', '--name-status'], { reject: false });
      return stdout || 'No unstaged changes';
    } catch (error: any) {
      return `Error getting unstaged files: ${error.message}`;
    }
  },
  {
    name: 'git_unstaged_files',
    description: 'List all unstaged modified files.',
    schema: z.object({}),
  }
);

export const gitUntrackedFilesTool = tool(
  async () => {
    try {
      console.log(`  ❓ Agent is listing untracked files`);
      const { stdout } = await execa('git', ['ls-files', '--others', '--exclude-standard'], { reject: false });
      return stdout || 'No untracked files';
    } catch (error: any) {
      return `Error getting untracked files: ${error.message}`;
    }
  },
  {
    name: 'git_untracked_files',
    description: 'List all untracked files (files not yet added to git).',
    schema: z.object({}),
  }
);

export const gitShowFileDiffTool = tool(
  async ({ filePath }: { filePath: string }) => {
    try {
      console.log(`  🔎 Agent is viewing diff for: ${filePath}`);
      const { stdout } = await execa('git', ['diff', '--cached', filePath], { reject: false });
      return stdout || 'No changes in this file';
    } catch (error: any) {
      return `Error getting file diff: ${error.message}`;
    }
  },
  {
    name: 'git_show_file_diff',
    description: 'Show the detailed diff for a specific staged file.',
    schema: z.object({
      filePath: z.string().describe('Path to the file to show diff for'),
    }),
  }
);

export const tools = [
  readFileTool,
  listDirTool,
  gitCommitHistoryTool,
  gitStagedFilesTool,
  gitUnstagedFilesTool,
  gitUntrackedFilesTool,
  gitShowFileDiffTool,
];
