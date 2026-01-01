import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { readFile, readdir, stat } from 'fs/promises';
import { join, isAbsolute, relative } from 'path';

// Helper to ensure we don't read outside of the project
const validatePath = (p: string) => {
    if (p.includes('..')) throw new Error('Cannot access parent directories');
    return p;
};

export const readFileTool = tool(
    async ({ filePath }: { filePath: string }) => {
        try {
            const content = await readFile(validatePath(filePath), 'utf-8');
            return content;
        } catch (error: any) {
            return `Error reading file ${filePath}: ${error.message}`;
        }
    },
    {
        name: 'read_file',
        description: 'Read the contents of a file to understand code context.',
        schema: z.object({
            filePath: z.string().describe('The path to the file to read (relative to project root)'),
        }),
    }
);

export const listDirTool = tool(
    async ({ dirPath }: { dirPath: string }) => {
        try {
            const files = await readdir(validatePath(dirPath));
            // Add a simple logic to show if it's a file or dir
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

export const tools = [readFileTool, listDirTool];
