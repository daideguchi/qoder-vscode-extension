import * as vscode from 'vscode';
import { QuestManager } from './core/QuestManager';
import { MemorySystem } from './core/MemorySystem';
import { RepoWikiGenerator } from './core/RepoWikiGenerator';
import { ContextSearchEngine } from './core/ContextSearchEngine';
import { InlineChatProvider } from './providers/InlineChatProvider';
import { QuestViewProvider } from './providers/QuestViewProvider';
import { MemoryViewProvider } from './providers/MemoryViewProvider';
import { DDSystemIntegration } from './integration/DDSystemIntegration';

let questManager: QuestManager;
let memorySystem: MemorySystem;
let wikiGenerator: RepoWikiGenerator;
let contextSearch: ContextSearchEngine;
let inlineChatProvider: InlineChatProvider;
let ddIntegration: DDSystemIntegration;

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Qoder AI Development Agent is now active!');

    // Initialize core systems
    questManager = new QuestManager(context);
    memorySystem = new MemorySystem(context);
    wikiGenerator = new RepoWikiGenerator();
    contextSearch = new ContextSearchEngine(context);
    inlineChatProvider = new InlineChatProvider(memorySystem);
    ddIntegration = new DDSystemIntegration();

    // Initialize view providers
    const questViewProvider = new QuestViewProvider(questManager);
    const memoryViewProvider = new MemoryViewProvider(memorySystem);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('qoder.questView', questViewProvider);
    vscode.window.registerTreeDataProvider('qoder.memoryView', memoryViewProvider);

    // Register commands
    registerCommands(context);

    // Set context variables
    vscode.commands.executeCommand('setContext', 'qoder.hasActiveQuests', true);
    vscode.commands.executeCommand('setContext', 'qoder.memoryEnabled', true);

    // Initialize memory system and DD integration
    Promise.all([
        memorySystem.initialize(),
        ddIntegration.initialize()
    ]).then(([memoryResult, ddResult]) => {
        console.log('🧠 Memory system initialized');
        if (ddResult) {
            console.log('🔗 DD System integration initialized');
        }
    });

    console.log('✅ Qoder extension activated successfully');
}

function registerCommands(context: vscode.ExtensionContext) {
    // Quest Mode (Command + E)
    const startQuestCommand = vscode.commands.registerCommand('qoder.startQuest', async () => {
        try {
            await questManager.startNewQuest();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start quest: ${error}`);
        }
    });

    // Inline Chat (Command + I)
    const inlineChatCommand = vscode.commands.registerCommand('qoder.inlineChat', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await inlineChatProvider.showInlineChat(editor);
            } else {
                vscode.window.showWarningMessage('Please open a file to use inline chat');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Inline chat failed: ${error}`);
        }
    });

    // Generate Wiki (Repoki) - Works globally
    const generateWikiCommand = vscode.commands.registerCommand('qoder.generateWiki', async () => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            let targetPath: string;

            if (workspaceFolder) {
                // Use existing workspace
                targetPath = workspaceFolder.uri.fsPath;
            } else {
                // No workspace - let user choose directory or create new project
                const choice = await vscode.window.showQuickPick([
                    'Select existing directory to analyze',
                    'Create wiki for new project (choose location)'
                ], {
                    placeHolder: 'No workspace open. Choose how to proceed:'
                });

                if (!choice) return;

                const folderUri = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: choice.includes('Select') ? 'Analyze This Directory' : 'Create Project Here'
                });

                if (!folderUri || folderUri.length === 0) return;
                targetPath = folderUri[0].fsPath;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Project Wiki...",
                cancellable: false
            }, async (progress) => {
                await wikiGenerator.generateProjectWiki(targetPath, progress);
            });
            
            vscode.window.showInformationMessage('📚 Project Wiki generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Wiki generation failed: ${error}`);
        }
    });

    // Context Search - Works globally
    const contextSearchCommand = vscode.commands.registerCommand('qoder.contextSearch', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter search query (works globally)',
                placeHolder: 'Search across codebase, memory, and external sources...'
            });

            if (query) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                const searchPath = workspaceFolder?.uri.fsPath || null;
                
                await contextSearch.performSemanticSearch(query, searchPath);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Context search failed: ${error}`);
        }
    });

    // Show Memory
    const showMemoryCommand = vscode.commands.registerCommand('qoder.showMemory', async () => {
        try {
            await memorySystem.showMemoryPanel();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show memory: ${error}`);
        }
    });

    // DD System Integration Commands
    const executeCodexCommand = vscode.commands.registerCommand('qoder.executeCodex', async () => {
        try {
            const task = await vscode.window.showInputBox({
                prompt: 'Enter task for Codex',
                placeHolder: 'e.g., "Create a REST API endpoint for user authentication"'
            });

            if (!task) return;

            const mode = await vscode.window.showQuickPick(['Quick', 'Marathon'], {
                placeHolder: 'Select execution mode'
            });

            if (!mode) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Executing Codex (${mode})...`,
                cancellable: false
            }, async () => {
                const result = await ddIntegration.executeCodex(
                    task, 
                    mode.toLowerCase() as 'quick' | 'marathon'
                );
                
                if (result.success) {
                    // Show result in new document
                    const doc = await vscode.workspace.openTextDocument({
                        content: `// Codex Result (${result.executionTime}ms)\n\n${result.output}`,
                        language: 'javascript'
                    });
                    await vscode.window.showTextDocument(doc);
                } else {
                    vscode.window.showErrorMessage(`Codex execution failed: ${result.error}`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Codex execution failed: ${error}`);
        }
    });

    const superClaudeCommand = vscode.commands.registerCommand('qoder.executeSuperClaude', async () => {
        try {
            const command = await vscode.window.showQuickPick([
                'build --optimize',
                'test --comprehensive',
                'review --security-focus',
                'design --frontend-agent',
                'research --brave-enhanced'
            ], {
                placeHolder: 'Select SuperClaude command'
            });

            if (!command) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Executing SuperClaude command...",
                cancellable: false
            }, async () => {
                const result = await ddIntegration.executeSuperClaudeCommand(command);
                vscode.window.showInformationMessage(`SuperClaude: ${result}`);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`SuperClaude execution failed: ${error}`);
        }
    });

    const generateMediaCommand = vscode.commands.registerCommand('qoder.generateMedia', async () => {
        try {
            const mediaType = await vscode.window.showQuickPick(['Image (Canva)', 'Video (CapCut)'], {
                placeHolder: 'Select media type to generate'
            });

            if (!mediaType) return;

            const title = await vscode.window.showInputBox({
                prompt: 'Enter title for the media',
                placeHolder: 'e.g., "Project Demo Video"'
            });

            if (!title) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Generating ${mediaType}...`,
                cancellable: false
            }, async () => {
                if (mediaType.includes('Canva')) {
                    const subtitle = await vscode.window.showInputBox({
                        prompt: 'Enter subtitle',
                        placeHolder: 'e.g., "Built with AI assistance"'
                    });
                    
                    const result = await ddIntegration.generateWithCanva(title, subtitle || '');
                    vscode.window.showInformationMessage(`Image generated: ${result.download_url || 'Success'}`);
                } else {
                    const result = await ddIntegration.createWithCapCut(title);
                    vscode.window.showInformationMessage(`Video created: ${result.draft_url || 'Success'}`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Media generation failed: ${error}`);
        }
    });

    const ddStatusCommand = vscode.commands.registerCommand('qoder.ddStatus', async () => {
        try {
            const config = ddIntegration.getConfig();
            const statusItems = [
                `DD System Path: ${config.systemPath}`,
                `Codex Available: ${config.codexAvailable ? '✅' : '❌'}`,
                `SuperClaude Available: ${config.superClaudeAvailable ? '✅' : '❌'}`,
                `Brave API: ${config.braveApiKey ? '✅' : '❌'}`,
                `OpenAI API: ${config.openaiApiKey ? '✅' : '❌'}`
            ];

            vscode.window.showInformationMessage(
                `DD System Status:\n${statusItems.join('\n')}`,
                { modal: true }
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Status check failed: ${error}`);
        }
    });

    // Register all commands
    context.subscriptions.push(
        startQuestCommand,
        inlineChatCommand,
        generateWikiCommand,
        contextSearchCommand,
        showMemoryCommand,
        executeCodexCommand,
        superClaudeCommand,
        generateMediaCommand,
        ddStatusCommand
    );
}

export function deactivate() {
    console.log('🔄 Qoder extension is being deactivated');
    
    // Cleanup resources
    if (memorySystem) {
        memorySystem.dispose();
    }
    if (questManager) {
        questManager.dispose();
    }
}