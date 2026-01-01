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

interface UserPreferences {
    useConventionalCommits: boolean;
    commitMessageStyle: 'concise' | 'descriptive';
}

async function getStoredPreferences(): Promise<UserPreferences | null> {
    try {
        const data = await readFile(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(data);
        return config.preferences || null;
    } catch {
        return null;
    }
}

async function storePreferences(prefs: UserPreferences) {
    try {
        let config: any = {};
        try {
            const data = await readFile(CONFIG_PATH, 'utf-8');
            config = JSON.parse(data);
        } catch {
            // file doesn't exist yet
        }
        config.preferences = prefs;
        await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
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

    // 3. Check/Set User Preferences
    let preferences = await getStoredPreferences();

    if (!preferences) {
        note('Let\'s set up your commit message preferences (one-time setup)', 'First Time Setup');

        const useConventional = await confirm({
            message: 'Use conventional commit prefixes (feat:, fix:, chore:, etc.)?',
            initialValue: true,
        });

        if (isCancel(useConventional)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        const styleChoice = await confirm({
            message: 'Prefer descriptive commit messages?',
            active: 'Descriptive (detailed explanations)',
            inactive: 'Concise (short and to the point)',
            initialValue: false,
        });

        if (isCancel(styleChoice)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        preferences = {
            useConventionalCommits: useConventional as boolean,
            commitMessageStyle: styleChoice ? 'descriptive' : 'concise',
        };

        await storePreferences(preferences);
        note(`Preferences saved! You can change these by editing ${CONFIG_PATH}`, 'Setup Complete');
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
            commitMessage = (await generateCommitMessage(diff, preferences)) as string;
        } catch (error: any) {
            s.stop('Generation failed.');
            cancel(`Error: ${error.message}`);
            return;
        }
        s.stop('Message generated.');

        // Format and display the commit message with proper wrapping and highlighting
        const maxWidth = 80;
        const lines = commitMessage.split('\n');
        const wrappedLines: string[] = [];

        for (const line of lines) {
            if (line.length <= maxWidth) {
                wrappedLines.push(line);
            } else {
                // Wrap long lines
                const words = line.split(' ');
                let currentLine = '';
                for (const word of words) {
                    if ((currentLine + ' ' + word).trim().length <= maxWidth) {
                        currentLine = currentLine ? currentLine + ' ' + word : word;
                    } else {
                        if (currentLine) wrappedLines.push(currentLine);
                        currentLine = word;
                    }
                }
                if (currentLine) wrappedLines.push(currentLine);
            }
        }

        const formattedMessage = wrappedLines.map(line => pc.cyan(line)).join('\n');
        note(formattedMessage, pc.bold('Proposed Commit Message'));

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
