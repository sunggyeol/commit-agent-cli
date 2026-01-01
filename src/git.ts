import { execa } from 'execa';

export async function getStagedDiff(): Promise<string> {
    const { stdout } = await execa('git', ['diff', '--cached'], {
        reject: false,
    });
    return stdout;
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
