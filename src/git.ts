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

export async function getStagedFiles(): Promise<string[]> {
    const { stdout } = await execa('git', ['diff', '--cached', '--name-only'], {
        reject: false,
    });
    return stdout ? stdout.split('\n').filter(Boolean) : [];
}

export async function getUnstagedFiles(): Promise<string[]> {
    const { stdout } = await execa('git', ['diff', '--name-only'], {
        reject: false,
    });
    return stdout ? stdout.split('\n').filter(Boolean) : [];
}

export async function getUntrackedFiles(): Promise<string[]> {
    const { stdout } = await execa('git', ['ls-files', '--others', '--exclude-standard'], {
        reject: false,
    });
    return stdout ? stdout.split('\n').filter(Boolean) : [];
}

export async function getRecentCommits(count: number = 5): Promise<Array<{ hash: string; message: string }>> {
    const { stdout } = await execa('git', ['log', `-${count}`, '--pretty=format:%h|%s'], {
        reject: false,
    });

    if (!stdout) return [];

    return stdout.split('\n').map(line => {
        const [hash, ...messageParts] = line.split('|');
        return { hash, message: messageParts.join('|') };
    });
}

export async function getStagedStats(): Promise<{ files: number; insertions: number; deletions: number }> {
    const { stdout: stats } = await execa('git', ['diff', '--cached', '--stat'], {
        reject: false,
    });

    if (!stats) return { files: 0, insertions: 0, deletions: 0 };

    // Parse stats like "3 files changed, 45 insertions(+), 12 deletions(-)"
    const match = stats.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

    return {
        files: match ? parseInt(match[1]) : 0,
        insertions: match && match[2] ? parseInt(match[2]) : 0,
        deletions: match && match[3] ? parseInt(match[3]) : 0,
    };
}

export async function stageFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await execa('git', ['add', ...files]);
}

export async function getFileStatus(file: string): Promise<'modified' | 'added' | 'deleted' | 'untracked'> {
    // Check if untracked first
    const { stdout: untrackedCheck } = await execa('git', ['ls-files', '--others', '--exclude-standard', file], {
        reject: false,
    });
    if (untrackedCheck) return 'untracked';

    // Check diff status
    const { stdout: status } = await execa('git', ['diff', '--name-status', file], {
        reject: false,
    });

    if (status.startsWith('M')) return 'modified';
    if (status.startsWith('A')) return 'added';
    if (status.startsWith('D')) return 'deleted';

    return 'modified'; // fallback
}

