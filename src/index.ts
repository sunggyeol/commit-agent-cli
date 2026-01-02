#!/usr/bin/env node
import 'dotenv/config';
import { intro, outro, text, spinner, confirm, isCancel, cancel, note, select, multiselect } from '@clack/prompts';
import {
    getStagedDiffSmart,
    commit,
    push,
    isGitRepository,
    getStagedFiles,
    getUnstagedFiles,
    getUntrackedFiles,
    getRecentCommits,
    getStagedStats,
    stageFiles,
    getFileStatus
} from './git.js';
import { generateCommitMessage } from './agent.js';
import pc from 'picocolors';
import updateNotifier from 'update-notifier';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join as joinPath } from 'path';
import { execa } from 'execa';

import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';

// Get package.json for version checking
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
    readFileSync(joinPath(__dirname, '../package.json'), 'utf-8')
);

// Check for updates - always check on every run (no caching)
const notifier = updateNotifier({
    pkg: packageJson,
    updateCheckInterval: 0, // Always check for updates (no cache)
});

// Show notification if update is available
if (notifier.update && notifier.update.current !== notifier.update.latest) {
    const currentVersion = notifier.update.current;
    const latestVersion = notifier.update.latest;
    
    // Build message lines without colors first to calculate padding
    const line1Text = `${packageJson.name} update available! ${currentVersion} → ${latestVersion}`;
    const line2Text = `Run npm install -g ${packageJson.name}@latest to update.`;
    
    // Find the longest line to determine box width
    const maxLength = Math.max(line1Text.length, line2Text.length);
    const boxWidth = maxLength + 2; // Add 2 for left/right padding
    
    // Helper to pad a line with spaces
    const padLine = (text: string, visibleLength: number): string => {
        const padding = boxWidth - visibleLength;
        return text + ' '.repeat(Math.max(0, padding));
    };
    
    // Build colored lines with proper padding
    const line1Colored = ` ${packageJson.name} update available! ${pc.cyan(currentVersion)} → ${pc.green(pc.bold(latestVersion))}`;
    const line2Colored = ` Run ${pc.cyan(pc.bold(`npm install -g ${packageJson.name}@latest`))} to update.`;
    
    // Create border
    const horizontalBorder = '─'.repeat(boxWidth);
    
    console.log('');
    console.log(pc.yellow('╭' + horizontalBorder + '╮'));
    console.log(pc.yellow('│') + padLine(line1Colored, line1Text.length + 1) + pc.yellow('│'));
    console.log(pc.yellow('│') + padLine(line2Colored, line2Text.length + 1) + pc.yellow('│'));
    console.log(pc.yellow('╰' + horizontalBorder + '╯'));
    console.log('');
}

const CONFIG_PATH = join(homedir(), '.commit-cli.json');

type AIProvider = 'anthropic' | 'google';

interface ModelConfig {
    provider: AIProvider;
    model: string;
}

interface AppConfig {
    provider: AIProvider;
    model: string;
    ANTHROPIC_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    preferences?: UserPreferences;
}

interface UserPreferences {
    useConventionalCommits: boolean;
    commitMessageStyle: 'concise' | 'descriptive';
    customGuideline?: string;
}

// Model options for each provider
const ANTHROPIC_MODELS = {
    'claude-sonnet-4-20250514': 'Claude Sonnet 4.5',
    'claude-opus-4-20250514': 'Claude Opus 4.5',
} as const;

const GOOGLE_MODELS = {
    'gemini-3-flash-preview': 'Gemini 3.0 Flash Preview',
    'gemini-3-pro-preview': 'Gemini 3.0 Pro Preview',
} as const;

async function getStoredConfig(): Promise<AppConfig | null> {
    try {
        const data = await readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

async function storeConfig(config: AppConfig) {
    try {
        await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
    } catch (err) {
        // ignore error
    }
}

// Legacy function for backward compatibility
async function getStoredKey(): Promise<string | null> {
    try {
        const data = await readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data).ANTHROPIC_API_KEY;
    } catch {
        return null;
    }
}

// Legacy function for backward compatibility
async function storeKey(key: string) {
    try {
        const config = await getStoredConfig() || {} as AppConfig;
        config.ANTHROPIC_API_KEY = key;
        await storeConfig(config);
    } catch (err) {
        // ignore error
    }
}

async function getStoredPreferences(): Promise<UserPreferences | null> {
    try {
        const config = await getStoredConfig();
        return config?.preferences || null;
    } catch {
        return null;
    }
}

async function storePreferences(prefs: UserPreferences) {
    try {
        const config = await getStoredConfig() || {} as AppConfig;
        config.preferences = prefs;
        await storeConfig(config);
    } catch (err) {
        // ignore error
    }
}

async function setupProviderAndModel(): Promise<ModelConfig> {
    const providerChoice = await select({
        message: 'Select AI Provider:',
        options: [
            { value: 'anthropic', label: 'Anthropic (Claude)' },
            { value: 'google', label: 'Google (Gemini)' }
        ],
        initialValue: 'anthropic',
    });

    if (isCancel(providerChoice)) {
        cancel('Operation cancelled.');
        process.exit(0);
    }

    const provider = providerChoice as AIProvider;
    let model: string;

    if (provider === 'anthropic') {
        const modelChoice = await select({
            message: 'Select Anthropic Model:',
            options: [
                { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4.5 (Recommended)' },
                { value: 'claude-opus-4-20250514', label: 'Claude Opus 4.5 (Most Capable)' }
            ],
            initialValue: 'claude-sonnet-4-20250514',
        });

        if (isCancel(modelChoice)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        model = modelChoice as string;
    } else {
        const modelChoice = await select({
            message: 'Select Google Model:',
            options: [
                { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash Preview (Fast)' },
                { value: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro Preview (Most Capable)' }
            ],
            initialValue: 'gemini-3-flash-preview',
        });

        if (isCancel(modelChoice)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        model = modelChoice as string;
    }

    return { provider, model };
}

async function promptForApiKey(provider: AIProvider): Promise<string> {
    if (provider === 'anthropic') {
        const key = await text({
            message: 'Enter your Anthropic API Key (sk-ant-...):',
            placeholder: 'sk-ant-api...',
            validate: (value) => {
                if (!value) return 'API Key is required';
                if (!value.startsWith('sk-ant-')) return 'Invalid API Key format (should start with sk-ant-)';
            }
        });

        if (isCancel(key)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        return key as string;
    } else {
        const key = await text({
            message: 'Enter your Google AI API Key:',
            placeholder: 'AIza...',
            validate: (value) => {
                if (!value) return 'API Key is required';
            }
        });

        if (isCancel(key)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        return key as string;
    }
}

async function showGuidedStaging(): Promise<boolean> {
    const s = spinner();
    s.start('Checking for unstaged and untracked files...');

    const [unstaged, untracked] = await Promise.all([
        getUnstagedFiles(),
        getUntrackedFiles()
    ]);

    s.stop('Files found.');

    const allFiles = [
        ...unstaged.map(f => ({ file: f, status: 'modified' as const })),
        ...untracked.map(f => ({ file: f, status: 'untracked' as const }))
    ];

    if (allFiles.length === 0) {
        note('No changes to stage. Make some changes first!', 'No Changes');
        return false;
    }

    note(`Found ${allFiles.length} file(s) with changes`, 'Available Files');

    const selectedFiles = await multiselect({
        message: 'Select files to stage (Space to select, Enter to continue):',
        options: allFiles.map(({ file, status }) => ({
            value: file,
            label: `${file} (${status})`,
        })),
        required: false,
    });

    if (isCancel(selectedFiles)) {
        return false;
    }

    if (!selectedFiles || (selectedFiles as string[]).length === 0) {
        note('No files selected. You can run "git add <files>" manually.', 'Skipped');
        return false;
    }

    s.start('Staging selected files...');
    await stageFiles(selectedFiles as string[]);
    s.stop(`Staged ${(selectedFiles as string[]).length} file(s).`);

    return true;
}

async function showSettingsMenu(currentConfig: AppConfig): Promise<AppConfig | null> {
    const providerLabel = currentConfig.provider === 'anthropic' ? 'Anthropic (Claude)' : 'Google (Gemini)';
    const modelName = currentConfig.provider === 'anthropic' 
        ? ANTHROPIC_MODELS[currentConfig.model as keyof typeof ANTHROPIC_MODELS] || currentConfig.model
        : GOOGLE_MODELS[currentConfig.model as keyof typeof GOOGLE_MODELS] || currentConfig.model;
    
    note(`Current: ${providerLabel} - ${modelName}`, 'Current Configuration');

    const settingChoice = await select({
        message: 'What would you like to change?',
        options: [
            { value: 'provider', label: 'Change AI Provider & Model' },
            { value: 'apikey', label: 'Update API Key' },
            { value: 'preferences', label: 'Change Commit Preferences' },
            { value: 'cancel', label: 'Cancel' }
        ],
    });

    if (isCancel(settingChoice) || settingChoice === 'cancel') {
        return null;
    }

    const newConfig = { ...currentConfig };

    if (settingChoice === 'provider') {
        const modelConfig = await setupProviderAndModel();
        newConfig.provider = modelConfig.provider;
        newConfig.model = modelConfig.model;
        
        // Check if we need to prompt for API key for the new provider
        const keyField = modelConfig.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY';
        if (!newConfig[keyField]) {
            const apiKey = await promptForApiKey(modelConfig.provider);
            newConfig[keyField] = apiKey;
        }
        
        await storeConfig(newConfig);
        return newConfig;
    } else if (settingChoice === 'apikey') {
        const apiKey = await promptForApiKey(currentConfig.provider);
        const keyField = currentConfig.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY';
        newConfig[keyField] = apiKey;
        await storeConfig(newConfig);
        return newConfig;
    } else if (settingChoice === 'preferences') {
        const useConventional = await select({
            message: 'Use conventional commit prefixes (feat:, fix:, chore:, etc.)?',
            options: [
                { value: true, label: 'Yes' },
                { value: false, label: 'No' }
            ],
            initialValue: currentConfig.preferences?.useConventionalCommits ?? true,
        });

        if (isCancel(useConventional)) {
            return null;
        }

        const styleChoice = await select({
            message: 'Prefer descriptive commit messages?',
            options: [
                { value: true, label: 'Descriptive (detailed explanations)' },
                { value: false, label: 'Concise (short and to the point)' }
            ],
            initialValue: currentConfig.preferences?.commitMessageStyle === 'descriptive',
        });

        if (isCancel(styleChoice)) {
            return null;
        }

        const addCustomGuideline = await select({
            message: 'Add custom commit message guideline?',
            options: [
                { value: true, label: 'Yes, add custom guideline' },
                { value: false, label: 'No, use defaults' }
            ],
            initialValue: false,
        });

        if (isCancel(addCustomGuideline)) {
            return null;
        }

        let customGuideline: string | undefined = currentConfig.preferences?.customGuideline;

        if (addCustomGuideline) {
            const guidelineInput = await text({
                message: 'Enter your custom commit message guideline:',
                placeholder: 'e.g., Always mention ticket number, use imperative mood...',
                initialValue: currentConfig.preferences?.customGuideline || '',
            });

            if (isCancel(guidelineInput)) {
                return null;
            }

            customGuideline = (guidelineInput as string).trim() || undefined;
        } else {
            customGuideline = undefined;
        }

        newConfig.preferences = {
            useConventionalCommits: useConventional as boolean,
            commitMessageStyle: styleChoice ? 'descriptive' : 'concise',
            customGuideline,
        };

        await storeConfig(newConfig);
        return newConfig;
    }

    return null;
}

async function main() {
    intro(pc.bgBlue(pc.white(' commit-cli ')));

    // 1. Check/Setup Configuration
    let config = await getStoredConfig();
    
    // Handle backward compatibility: if old config exists with only ANTHROPIC_API_KEY
    if (config && config.ANTHROPIC_API_KEY && !config.provider) {
        note('Upgrading your configuration to support multiple AI providers...', 'Configuration Update');
        
        // Migrate old config to new format, defaulting to Anthropic with Sonnet 4.5
        config.provider = 'anthropic';
        config.model = 'claude-sonnet-4-20250514';
        
        await storeConfig(config);
        note('Configuration upgraded! You can now switch providers anytime using the settings menu.', 'Upgrade Complete');
    }
    
    // If no config exists, run first-time setup
    if (!config || !config.provider || !config.model) {
        note('Welcome! Let\'s set up your AI provider and preferences', 'First Time Setup');
        
        const modelConfig = await setupProviderAndModel();
        const apiKey = await promptForApiKey(modelConfig.provider);
        
        config = {
            provider: modelConfig.provider,
            model: modelConfig.model,
            ...(modelConfig.provider === 'anthropic' 
                ? { ANTHROPIC_API_KEY: apiKey } 
                : { GOOGLE_API_KEY: apiKey }
            )
        };
        
        await storeConfig(config);
    }

    // Check if API key exists for the selected provider
    const apiKeyField = config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY';
    const envKeyField = config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY';
    
    // Priority: env var > stored config > prompt
    let apiKey = process.env[envKeyField];
    
    if (!apiKey) {
        apiKey = config[apiKeyField] || undefined;
    }
    
    if (!apiKey) {
        apiKey = await promptForApiKey(config.provider);
        config[apiKeyField] = apiKey;
        await storeConfig(config);
    }

    // Set environment variable for the agent
    if (config.provider === 'anthropic') {
        process.env.ANTHROPIC_API_KEY = apiKey;
    } else {
        process.env.GOOGLE_API_KEY = apiKey;
    }

    // 2. Check Git Repo
    const isRepo = await isGitRepository();
    if (!isRepo) {
        cancel('Current directory is not a git repository.');
        process.exit(1);
    }

    // 3. Check/Set User Preferences
    let preferences = config.preferences;

    if (!preferences) {
        const useConventional = await select({
            message: 'Use conventional commit prefixes (feat:, fix:, chore:, etc.)?',
            options: [
                { value: true, label: 'Yes' },
                { value: false, label: 'No' }
            ],
            initialValue: true,
        });

        if (isCancel(useConventional)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        const styleChoice = await select({
            message: 'Prefer descriptive commit messages?',
            options: [
                { value: true, label: 'Descriptive (detailed explanations)' },
                { value: false, label: 'Concise (short and to the point)' }
            ],
            initialValue: false,
        });

        if (isCancel(styleChoice)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        const addCustomGuideline = await select({
            message: 'Add custom commit message guideline? (optional)',
            options: [
                { value: false, label: 'No, use defaults' },
                { value: true, label: 'Yes, add custom guideline' }
            ],
            initialValue: false,
        });

        if (isCancel(addCustomGuideline)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        let customGuideline: string | undefined;

        if (addCustomGuideline) {
            const guidelineInput = await text({
                message: 'Enter your custom commit message guideline:',
                placeholder: 'e.g., Always mention ticket number, use imperative mood...',
            });

            if (isCancel(guidelineInput)) {
                cancel('Operation cancelled.');
                process.exit(0);
            }

            customGuideline = (guidelineInput as string).trim() || undefined;
        }

        preferences = {
            useConventionalCommits: useConventional as boolean,
            commitMessageStyle: styleChoice ? 'descriptive' : 'concise',
            customGuideline,
        };

        config.preferences = preferences;
        await storeConfig(config);
        note(`Preferences saved! You can change these anytime in the settings menu.`, 'Setup Complete');
    }

    // 3. Check for staged changes & offer guided staging if needed
    const s = spinner();
    s.start('Checking staged changes...');
    let diff = await getStagedDiffSmart();

    if (!diff) {
        s.stop('No staged changes found.');

        const shouldStage = await select({
            message: 'No staged changes. Would you like to stage files now?',
            options: [
                { value: true, label: 'Yes, show me files to stage' },
                { value: false, label: 'No, I\'ll stage manually' }
            ],
            initialValue: true,
        });

        if (isCancel(shouldStage) || !shouldStage) {
            cancel('Please stage your changes using "git add" first.');
            process.exit(0);
        }

        const staged = await showGuidedStaging();
        if (!staged) {
            cancel('No files were staged. Exiting.');
            process.exit(0);
        }

        // Re-check staged changes
        s.start('Analyzing staged changes...');
        diff = await getStagedDiffSmart();
        if (!diff) {
            s.stop('Still no staged changes.');
            cancel('Something went wrong. Please try again.');
            process.exit(0);
        }
    }
    s.stop('Changes detected.');

    // 4. Show preview of changes
    const stats = await getStagedStats();
    const stagedFiles = await getStagedFiles();

    let previewMessage = pc.cyan(`${stats.files} file(s) changed`);
    if (stats.insertions > 0) previewMessage += pc.green(`, ${stats.insertions} insertion(s)`);
    if (stats.deletions > 0) previewMessage += pc.red(`, ${stats.deletions} deletion(s)`);
    previewMessage += '\n' + stagedFiles.map(f => `  • ${f}`).join('\n');

    note(previewMessage, 'Changes Summary');

    // 5. Show recent commits for context
    const recentCommits = await getRecentCommits(5);
    if (recentCommits.length > 0) {
        const commitsMessage = recentCommits
            .map(c => `  ${pc.dim(c.hash)} ${c.message}`)
            .join('\n');
        note(commitsMessage, 'Recent Commits');
    }

    // 6. Check for unstaged changes and warn
    const [unstaged, untracked] = await Promise.all([
        getUnstagedFiles(),
        getUntrackedFiles()
    ]);

    if (unstaged.length > 0 || untracked.length > 0) {
        const unstagedCount = unstaged.length + untracked.length;
        const warningMessage = `You have ${unstagedCount} unstaged file(s):\n` +
            [...unstaged.map(f => `  • ${f} (modified)`), ...untracked.map(f => `  • ${f} (untracked)`)].join('\n');

        note(pc.yellow(warningMessage), pc.yellow('⚠ Unstaged Changes'));

        const includeUnstaged = await select({
            message: 'Include these files in this commit?',
            options: [
                { value: false, label: 'No, continue with current staging' },
                { value: true, label: 'Yes, let me select which ones' }
            ],
            initialValue: false,
        });

        if (!isCancel(includeUnstaged) && includeUnstaged) {
            const additionalFiles = await multiselect({
                message: 'Select additional files to stage:',
                options: [
                    ...unstaged.map(f => ({ value: f, label: `${f} (modified)` })),
                    ...untracked.map(f => ({ value: f, label: `${f} (untracked)` }))
                ],
                required: false,
            });

            if (!isCancel(additionalFiles) && additionalFiles && (additionalFiles as string[]).length > 0) {
                s.start('Staging additional files...');
                await stageFiles(additionalFiles as string[]);

                // Refresh diff with newly staged files
                diff = await getStagedDiffSmart();
                s.stop('Additional files staged.');
            }
        }
    }

    // 7. Detect large changesets and suggest splitting
    const totalChanges = stats.insertions + stats.deletions;
    if (stats.files >= 10 || totalChanges >= 500) {
        const largeChangesetMessage = pc.yellow(
            `⚠ Large changeset detected (${stats.files} files, ${totalChanges} changes)\n` +
            `Consider splitting into smaller, focused commits for better review.`
        );
        note(largeChangesetMessage, pc.yellow('Large Changeset Warning'));

        const proceedWithLarge = await select({
            message: 'How would you like to proceed?',
            options: [
                { value: 'continue', label: 'Continue with all changes' },
                { value: 'reselect', label: 'Let me re-select files to commit' },
                { value: 'cancel', label: 'Cancel and stage manually' }
            ],
            initialValue: 'continue',
        });

        if (isCancel(proceedWithLarge) || proceedWithLarge === 'cancel') {
            cancel('Cancelled. Use "git add" to stage specific files.');
            process.exit(0);
        }

        if (proceedWithLarge === 'reselect') {
            // Unstage all, then let user re-select
            await execa('git', ['reset', 'HEAD']);
            const restaged = await showGuidedStaging();
            if (!restaged) {
                cancel('No files were staged. Exiting.');
                process.exit(0);
            }

            // Refresh diff
            diff = await getStagedDiffSmart();
            if (!diff) {
                cancel('No staged changes. Exiting.');
                process.exit(0);
            }
        }
    }

    // 4. Generate Message Loop
    let commitMessage = '';
    let confirmed = false;
    let userFeedback: string | undefined = undefined;

    while (!confirmed) {
        s.start('Generating commit message (Agent is exploring)...');
        try {
            commitMessage = (await generateCommitMessage(diff, preferences, config, userFeedback)) as string;
            userFeedback = undefined; // Reset feedback after using it
        } catch (error: any) {
            s.stop('Generation failed.');
            
            // Check if it's an authentication error
            if (error.message?.includes('401') || 
                error.message?.includes('authentication_error') || 
                error.message?.includes('invalid x-api-key') ||
                error.message?.includes('invalid api key') ||
                error.message?.includes('API key not valid')) {
                
                cancel('Invalid API Key detected.');
                
                const retryWithNewKey = await select({
                    message: 'Would you like to enter a new API key?',
                    options: [
                        { value: true, label: 'Yes' },
                        { value: false, label: 'No' }
                    ],
                    initialValue: true,
                });

                if (isCancel(retryWithNewKey) || !retryWithNewKey) {
                    cancel('Operation cancelled.');
                    process.exit(0);
                }

                const newKey = await promptForApiKey(config.provider);
                apiKey = newKey;
                
                // Update config with new key
                const keyField = config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY';
                config[keyField] = apiKey;
                await storeConfig(config);
                
                // Set environment variable
                if (config.provider === 'anthropic') {
                    process.env.ANTHROPIC_API_KEY = apiKey;
                } else {
                    process.env.GOOGLE_API_KEY = apiKey;
                }
                
                note('API Key updated. Retrying...', 'Key Updated');
                continue; // Retry with new key
            }
            
            // For other errors, just show the error and exit
            cancel(`Error: ${error.message}`);
            return;
        }
        s.stop('Message generated.');

        // Format and display the commit message with proper wrapping and highlighting
        // Use terminal width with padding for box borders and margins
        const terminalWidth = process.stdout.columns || 80;
        // Account for clack's note box padding (usually ~10 chars for borders and margins)
        const maxWidth = Math.max(40, terminalWidth - 12);
        const lines = commitMessage.split('\n');
        const wrappedLines: string[] = [];

        for (const line of lines) {
            if (line.length <= maxWidth) {
                wrappedLines.push(line);
            } else {
                // Wrap long lines at word boundaries
                const words = line.split(' ');
                let currentLine = '';
                for (const word of words) {
                    const testLine = currentLine ? currentLine + ' ' + word : word;
                    if (testLine.length <= maxWidth) {
                        currentLine = testLine;
                    } else {
                        if (currentLine) wrappedLines.push(currentLine);
                        // Handle very long words that don't fit
                        if (word.length > maxWidth) {
                            // Split long words
                            let remaining = word;
                            while (remaining.length > maxWidth) {
                                wrappedLines.push(remaining.substring(0, maxWidth));
                                remaining = remaining.substring(maxWidth);
                            }
                            currentLine = remaining;
                        } else {
                            currentLine = word;
                        }
                    }
                }
                if (currentLine) wrappedLines.push(currentLine);
            }
        }

        const formattedMessage = wrappedLines.map(line => pc.cyan(line)).join('\n');
        note(formattedMessage, pc.bold('Proposed Commit Message'));

        // Only show edit option for single-line messages
        const isMultiLine = commitMessage.includes('\n');
        const actionOptions = [
            { value: 'commit', label: 'Yes, commit' },
            ...(isMultiLine ? [] : [{ value: 'edit', label: 'Edit message' }]),
            { value: 'regenerate', label: 'Regenerate' },
            { value: 'settings', label: 'Change settings' }
        ];

        const action = await select({
            message: 'Do you want to use this message?',
            options: actionOptions,
        });

        if (isCancel(action)) {
            cancel('Operation cancelled.');
            process.exit(0);
        }

        if (action === 'commit') {
            confirmed = true;
        } else if (action === 'edit') {
            // Allow user to edit the commit message directly
            const editedMessage = await text({
                message: 'Edit your commit message:',
                initialValue: commitMessage,
                validate: (value) => {
                    if (!value || value.trim() === '') return 'Commit message cannot be empty';
                }
            });

            if (isCancel(editedMessage)) {
                // User cancelled editing, go back to reviewing the original message
                continue;
            }

            commitMessage = editedMessage as string;

            // Show the edited message and confirm
            const editedFormattedMessage = (editedMessage as string).split('\n').map(line => pc.cyan(line)).join('\n');
            note(editedFormattedMessage, pc.bold('Edited Commit Message'));

            const confirmEdited = await select({
                message: 'Use this edited message?',
                options: [
                    { value: true, label: 'Yes, commit' },
                    { value: false, label: 'No, go back' }
                ],
                initialValue: true,
            });

            if (isCancel(confirmEdited)) {
                continue;
            }

            if (confirmEdited) {
                confirmed = true;
            }
            // If not confirmed, loop continues to show original message again
        } else if (action === 'settings') {
            // Show settings menu
            const settingsResult = await showSettingsMenu(config);
            if (settingsResult) {
                config = settingsResult;
                // Update preferences from config
                preferences = config.preferences || preferences;
                // Update environment variables
                if (config.provider === 'anthropic') {
                    process.env.ANTHROPIC_API_KEY = config.ANTHROPIC_API_KEY || '';
                    delete process.env.GOOGLE_API_KEY;
                } else {
                    process.env.GOOGLE_API_KEY = config.GOOGLE_API_KEY || '';
                    delete process.env.ANTHROPIC_API_KEY;
                }
                // Reset agent with new config - will be done in agent.ts
                note('Settings updated! Regenerating with new configuration...', 'Updated');
            }
            // Continue loop to regenerate
        } else {
            const nextStep = await select({
                message: 'Try again?',
                options: [
                    { value: true, label: 'Regenerate' },
                    { value: false, label: 'Cancel' }
                ],
            });
            if (!nextStep || isCancel(nextStep)) {
                cancel('Operation cancelled.');
                process.exit(0);
            }

            // Ask for feedback on how to improve the message
            const feedback = await text({
                message: 'How should I adjust it?',
                placeholder: 'e.g., make it shorter, add more detail, or press enter to skip',
            });

            if (isCancel(feedback)) {
                cancel('Operation cancelled.');
                process.exit(0);
            }

            userFeedback = feedback && feedback.trim() !== '' ? feedback as string : undefined;
            // Loop continues to regenerate
        }
    }

    // 5. Commit
    s.start('Committing...');
    await commit(commitMessage);
    s.stop('Committed!');

    // 6. Push?
    const shouldPush = await select({
        message: 'Do you want to push changes now?',
        options: [
            { value: true, label: 'Yes' },
            { value: false, label: 'No' }
        ],
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
