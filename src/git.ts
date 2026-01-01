import { execa } from 'execa';

export async function getStagedDiff(): Promise<string> {
    const { stdout } = await execa('git', ['diff', '--cached'], {
        reject: false,
    });
    return stdout;
}

export async function getStagedDiffCompact(): Promise<string> {
    // Get a more compact diff suitable for LLM consumption
    // 1. Get file list with status
    const { stdout: fileList } = await execa('git', ['diff', '--cached', '--name-status'], {
        reject: false,
    });
    
    // 2. Get diff with reduced context (3 lines instead of default)
    const { stdout: diff } = await execa('git', ['diff', '--cached', '--unified=1', '--no-color'], {
        reject: false,
    });
    
    // 3. Get summary stats
    const { stdout: stats } = await execa('git', ['diff', '--cached', '--stat'], {
        reject: false,
    });
    
    // Combine into a compact format
    return `FILES CHANGED:
${fileList}

SUMMARY:
${stats}

DIFF (reduced context):
${diff}`;
}

export async function getStagedDiffSmart(): Promise<string> {
    // Get file list with status
    const { stdout: fileList } = await execa('git', ['diff', '--cached', '--name-status'], {
        reject: false,
    });
    
    if (!fileList) return '';
    
    // Get diff stats to check size
    const { stdout: stats } = await execa('git', ['diff', '--cached', '--stat'], {
        reject: false,
    });
    
    // Get diff with minimal context
    const { stdout: diff } = await execa('git', ['diff', '--cached', '--unified=1', '--no-color', '--no-prefix'], {
        reject: false,
    });
    
    // Estimate token count (rough: 1 token ≈ 4 chars)
    const estimatedTokens = diff.length / 4;
    
    // If diff is very large (>2000 tokens), provide even more compact version
    if (estimatedTokens > 2000) {
        // For very large diffs, use function-level context only
        const { stdout: compactDiff } = await execa('git', ['diff', '--cached', '--unified=0', '--no-color', '--no-prefix'], {
            reject: false,
        });
        
        return `FILES CHANGED (${fileList.split('\n').length} files):
${fileList}

STATS:
${stats}

DIFF (function signatures only - large changeset):
${compactDiff}

Note: This is a large changeset. The diff shows only changed lines without context.`;
    }
    
    // For medium diffs, use 1 line of context
    return `FILES CHANGED:
${fileList}

STATS:
${stats}

DIFF:
${diff}`;
}

export async function commit(message: string): Promise<void> {
    await execa('git', ['commit', '-m', message]);
}

export async function push(): Promise<void> {
    await execa('git', ['push']);
}

export async function isGitRepository(): Promise<boolean> {
    try {
        await execa('git', ['rev-parse', '--is-inside-work-tree']);
        return true;
    } catch {
        return false;
    }
}

