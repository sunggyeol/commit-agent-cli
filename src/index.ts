#!/usr/bin/env node
import 'dotenv/config';
import { intro, outro, text, spinner, confirm, isCancel, cancel, note } from '@clack/prompts';
import { getStagedDiff, commit, push, isGitRepository } from './git.js';
import { generateCommitMessage } from './agent.js';
import pc from 'picocolors';

import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';

const CONFIG_PATH = join(homedir(), '.commit-cli.json');

async function getStoredKey(): Promise<string | null> {
    try {
        const data = await readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data).ANTHROPIC_API_KEY;
    } catch {
        return null;
    }
}

async function storeKey(key: string) {
    try {
        await writeFile(CONFIG_PATH, JSON.stringify({ ANTHROPIC_API_KEY: key }), { mode: 0o600 });
    } catch (err) {
        // ignore error
    }
}

async function main() {
    intro(pc.bgBlue(pc.white(' commit-cli ')));

    // 1. Check API Key
    // Priority: env var > stored config > prompt
    let apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        apiKey = await getStoredKey() || undefined;
    }

    if (!apiKey) {
        const key = await text({
            message: 'Enter your Anthropic API Key (sk-...):',
            placeholder: 'sk-ant-api...',
            validate: (value) => {
                if (!value) return 'API Key is required';
                if (!value.startsWith('sk-')) return 'Invalid API Key format (should start with sk-)';
            }
        });

        if (isCancel(key)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        apiKey = key as string;
        await storeKey(apiKey);
    }

    process.env.ANTHROPIC_API_KEY = apiKey;

    // 2. Check Git Repo
    const isRepo = await isGitRepository();
    if (!isRepo) {
        cancel('Current directory is not a git repository.');
        process.exit(1);
    }

    // 3. Get Diff
    const s = spinner();
    s.start('Analyzing staged changes...');
    const diff = await getStagedDiff();

    if (!diff) {
        s.stop('No staged changes found.');
        cancel('Please stage your changes using "git add" first.');
        process.exit(0);
    }
    s.stop('Changes detected.');

    // 4. Generate Message Loop
    let commitMessage = '';
    let confirmed = false;

    while (!confirmed) {
        s.start('Generating commit message (Agent is exploring)...');
        try {
            commitMessage = (await generateCommitMessage(diff)) as string;
        } catch (error: any) {
            s.stop('Generation failed.');
            cancel(`Error: ${error.message}`);
            return;
        }
        s.stop('Message generated.');

        note(commitMessage, 'Proposed Commit Message');

        const action = await confirm({
            message: 'Do you want to use this message?',
            active: 'Yes, commit',
            inactive: 'No, regenerate or cancel'
        });

        if (isCancel(action)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        if (action) {
            confirmed = true;
        } else {
            const nextStep = await confirm({
                message: 'Try again?',
                active: 'Regenerate',
                inactive: 'Cancel'
            });
            if (!nextStep || isCancel(nextStep)) {
                cancel('Operation cancelled.');
                process.exit(0);
            }
            // Loop continues to regenerate
        }
    }

    // 5. Commit
    s.start('Committing...');
    await commit(commitMessage);
    s.stop('Committed!');

    // 6. Push?
    const shouldPush = await confirm({
        message: 'Do you want to push changes now?',
    });

    if (isCancel(shouldPush)) {
        outro(`Changes committed but NOT pushed.`);
        process.exit(0);
    }

    if (shouldPush) {
        s.start('Pushing...');
        try {
            await push();
            s.stop('Pushed!');
            outro('Successfully committed and pushed! 🚀');
        } catch (error: any) {
            s.stop('Push failed.');
            cancel(`Error pushing: ${error.message}`);
        }
    } else {
        outro('Changes committed locally. 👍');
    }
}

main().catch(console.error);
