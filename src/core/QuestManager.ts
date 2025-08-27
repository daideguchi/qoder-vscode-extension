import * as vscode from 'vscode';
import { OpenAI } from 'openai';

export interface QuestTask {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed';
    filePaths: string[];
    dependencies: string[];
    createdAt: Date;
    completedAt?: Date;
}

export interface QuestSpec {
    id: string;
    title: string;
    description: string;
    requirements: string[];
    tasks: QuestTask[];
    status: 'draft' | 'approved' | 'in-progress' | 'completed';
    createdAt: Date;
    approvedAt?: Date;
}

export class QuestManager {
    private context: vscode.ExtensionContext;
    private openai: OpenAI | null = null;
    private activeQuests: Map<string, QuestSpec> = new Map();
    private questPanel: vscode.WebviewPanel | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeOpenAI();
        this.loadQuests();
    }

    private initializeOpenAI() {
        const config = vscode.workspace.getConfiguration('qoder');
        const apiKey = config.get<string>('openai.apiKey');
        
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        } else {
            vscode.window.showWarningMessage(
                'OpenAI API key not configured. Please set qoder.openai.apiKey in settings.'
            );
        }
    }

    async startNewQuest(): Promise<void> {
        if (!this.openai) {
            vscode.window.showErrorMessage('OpenAI API not configured');
            return;
        }

        // Step 1: Get user input for quest description (works globally)
        const questInput = await vscode.window.showInputBox({
            prompt: 'Describe what you want to develop (works anywhere)',
            placeHolder: 'e.g., Create a REST API for user authentication with JWT tokens',
            ignoreFocusOut: true
        });

        if (!questInput) {
            return;
        }

        // Get optional workspace context (null if no workspace)
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workspacePath = workspaceFolder?.uri.fsPath || null;

        // Step 2: Show progress while generating spec
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "🤖 AI is analyzing your requirements...",
            cancellable: false
        }, async (progress) => {
            try {
                // Generate specification using AI (global capable)
                progress.report({ increment: 30, message: "Generating specification..." });
                const spec = await this.generateSpecification(questInput, workspacePath);
                
                progress.report({ increment: 50, message: "Breaking down into tasks..." });
                const tasks = await this.generateTasks(spec, workspacePath);
                
                progress.report({ increment: 20, message: "Creating quest..." });
                
                const quest: QuestSpec = {
                    id: this.generateId(),
                    title: spec.title,
                    description: spec.description,
                    requirements: spec.requirements,
                    tasks: tasks,
                    status: 'draft',
                    createdAt: new Date()
                };

                this.activeQuests.set(quest.id, quest);
                await this.saveQuests();
                
                // Step 3: Show specification for user approval
                await this.showSpecificationPanel(quest);
                
            } catch (error) {
                vscode.window.showErrorMessage(`Quest creation failed: ${error}`);
            }
        });
    }

    private async generateSpecification(input: string, workspacePath: string | null): Promise<{
        title: string;
        description: string;
        requirements: string[];
    }> {
        if (!this.openai) throw new Error('OpenAI not initialized');

        const contextNote = workspacePath 
            ? `\nCurrent workspace: ${workspacePath}\n(Consider existing project structure if applicable)`
            : '\n(No workspace context - generating standalone specification)';

        const prompt = `You are a senior software architect. Based on the user's request, create a detailed technical specification.

User Request: "${input}"${contextNote}

Please provide a response in JSON format with:
- title: A concise project title
- description: A detailed technical description (2-3 paragraphs)
- requirements: An array of specific technical requirements

Focus on:
1. Technical accuracy and feasibility
2. Best practices and modern standards
3. Clear, actionable requirements
4. Universal applicability (should work in any environment)
5. Standalone implementation capability

Response must be valid JSON.`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1500
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from AI');

        try {
            return JSON.parse(content);
        } catch (error) {
            throw new Error('Invalid response format from AI');
        }
    }

    private async generateTasks(spec: { title: string; description: string; requirements: string[] }, workspacePath: string | null): Promise<QuestTask[]> {
        if (!this.openai) throw new Error('OpenAI not initialized');

        const pathContext = workspacePath 
            ? `\nWorkspace path: ${workspacePath}\nGenerate file paths relative to this workspace.`
            : '\nNo specific workspace - generate generic/portable file structure that works anywhere.';

        const prompt = `You are a senior developer creating a task breakdown structure.

Project: ${spec.title}
Description: ${spec.description}
Requirements: ${spec.requirements.join('\n- ')}${pathContext}

Create a detailed task breakdown in JSON format. Each task should have:
- id: unique identifier
- title: clear, actionable title
- description: detailed description of what needs to be done
- filePaths: suggested file paths (generic if no workspace, specific if workspace provided)
- dependencies: array of task IDs that must be completed first

Tasks should be:
1. Logically ordered and properly dependent
2. Granular enough to be completed in 1-4 hours each
3. Include setup, implementation, testing, and documentation tasks
4. Follow best practices for the technology stack
5. Be executable in any environment (with or without specific workspace)
6. Include clear setup instructions when needed

Response must be valid JSON array of tasks.`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.6,
            max_tokens: 2000
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from AI');

        try {
            const rawTasks = JSON.parse(content);
            return rawTasks.map((task: any) => ({
                ...task,
                status: 'pending' as const,
                createdAt: new Date()
            }));
        } catch (error) {
            throw new Error('Invalid task format from AI');
        }
    }

    private async showSpecificationPanel(quest: QuestSpec): Promise<void> {
        if (this.questPanel) {
            this.questPanel.dispose();
        }

        this.questPanel = vscode.window.createWebviewPanel(
            'qoder-quest-spec',
            `Quest: ${quest.title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.questPanel.webview.html = this.getSpecificationHtml(quest);

        // Handle messages from webview
        this.questPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'approve':
                    quest.status = 'approved';
                    quest.approvedAt = new Date();
                    await this.saveQuests();
                    await this.startQuestExecution(quest);
                    vscode.window.showInformationMessage('🚀 Quest approved and started!');
                    break;
                    
                case 'modify':
                    // Allow user to modify spec
                    await this.modifySpecification(quest);
                    break;
                    
                case 'cancel':
                    this.activeQuests.delete(quest.id);
                    await this.saveQuests();
                    this.questPanel?.dispose();
                    vscode.window.showInformationMessage('Quest cancelled');
                    break;
            }
        });
    }

    private getSpecificationHtml(quest: QuestSpec): string {
        const requirementsHtml = quest.requirements.map(req => `<div class="requirement">• ${req}</div>`).join('');
        const tasksHtml = quest.tasks.map((task, index) => {
            const filesHtml = task.filePaths.length > 0 ? `<div class="task-files">Files: ${task.filePaths.join(', ')}</div>` : '';
            return `<div class="task">
                <div class="task-title">${index + 1}. ${task.title}</div>
                <div class="task-description">${task.description}</div>
                ${filesHtml}
            </div>`;
        }).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quest Specification</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title {
            font-size: 28px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin: 0 0 10px 0;
        }
        .description {
            font-size: 16px;
            margin-bottom: 20px;
            opacity: 0.9;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-editor-background);
        }
        .section-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            margin: 0 0 15px 0;
        }
        .requirement {
            margin: 8px 0;
            padding: 8px 12px;
            background: var(--vscode-inputOption-activeBackground);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        .task {
            margin: 15px 0;
            padding: 15px;
            background: var(--vscode-inputValidation-infoBackground);
            border-radius: 6px;
            border-left: 4px solid var(--vscode-button-background);
        }
        .task-title {
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 8px;
        }
        .task-description {
            margin-bottom: 10px;
            opacity: 0.9;
        }
        .task-files {
            font-size: 12px;
            color: var(--vscode-textLink-foreground);
            background: var(--vscode-terminal-background);
            padding: 5px 8px;
            border-radius: 3px;
            font-family: 'SF Mono', Consolas, monospace;
        }
        .buttons {
            display: flex;
            gap: 15px;
            margin-top: 40px;
            justify-content: center;
        }
        button {
            padding: 12px 24px;
            font-size: 14px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
        }
        .btn-approve {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-modify {
            background: var(--vscode-inputOption-activeBackground);
            color: var(--vscode-foreground);
        }
        .btn-cancel {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        button:hover {
            opacity: 0.8;
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${quest.title}</h1>
            <div class="description">${quest.description}</div>
        </div>

        <div class="section">
            <h2 class="section-title">📋 Technical Requirements</h2>
            ${requirementsHtml}
        </div>

        <div class="section">
            <h2 class="section-title">🎯 Task Breakdown (${quest.tasks.length} tasks)</h2>
            ${tasksHtml}
        </div>

        <div class="buttons">
            <button class="btn-approve" onclick="approveQuest()">✅ Approve & Start</button>
            <button class="btn-modify" onclick="modifyQuest()">✏️ Modify Spec</button>
            <button class="btn-cancel" onclick="cancelQuest()">❌ Cancel</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function approveQuest() {
            vscode.postMessage({ command: 'approve' });
        }

        function modifyQuest() {
            vscode.postMessage({ command: 'modify' });
        }

        function cancelQuest() {
            vscode.postMessage({ command: 'cancel' });
        }
    </script>
</body>
</html>
`;
    }

    private async startQuestExecution(quest: QuestSpec): Promise<void> {
        quest.status = 'in-progress';
        await this.saveQuests();
        
        // Show task execution panel
        // Implementation for task execution UI
    }

    private async modifySpecification(quest: QuestSpec): Promise<void> {
        // Implementation for spec modification
        vscode.window.showInformationMessage('Modification feature coming soon!');
    }

    private generateId(): string {
        return 'quest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    private async loadQuests(): Promise<void> {
        const questData = this.context.globalState.get<string>('qoder.activeQuests', '{}');
        try {
            const quests = JSON.parse(questData);
            this.activeQuests = new Map(Object.entries(quests));
        } catch (error) {
            console.error('Failed to load quests:', error);
            this.activeQuests = new Map();
        }
    }

    private async saveQuests(): Promise<void> {
        const questsObj = Object.fromEntries(this.activeQuests);
        await this.context.globalState.update('qoder.activeQuests', JSON.stringify(questsObj));
    }

    getActiveQuests(): QuestSpec[] {
        return Array.from(this.activeQuests.values());
    }

    dispose(): void {
        this.questPanel?.dispose();
    }
}