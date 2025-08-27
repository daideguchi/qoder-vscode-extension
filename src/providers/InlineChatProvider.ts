import * as vscode from 'vscode';
import { MemorySystem } from '../core/MemorySystem';
import { OpenAI } from 'openai';

export class InlineChatProvider {
    private memorySystem: MemorySystem;
    private openai: OpenAI | null = null;
    private chatPanel: vscode.WebviewPanel | null = null;
    private currentEditor: vscode.TextEditor | null = null;

    constructor(memorySystem: MemorySystem) {
        this.memorySystem = memorySystem;
        this.initializeAI();
    }

    private initializeAI(): void {
        const config = vscode.workspace.getConfiguration('qoder');
        const apiKey = config.get<string>('openai.apiKey');
        
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    async showInlineChat(editor: vscode.TextEditor): Promise<void> {
        this.currentEditor = editor;
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        // Get current context
        const currentFile = editor.document.fileName;
        const language = editor.document.languageId;
        
        // Show inline chat UI
        const position = selection.active;
        const decoration = this.createInlineDecoration(position);
        
        // Get user input
        const userQuery = await vscode.window.showInputBox({
            prompt: 'Ask about this code or request modifications',
            placeHolder: 'e.g., "Explain this function" or "Add error handling"'
        });

        if (!userQuery) return;

        // Process the query
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Processing with AI...",
            cancellable: false
        }, async () => {
            try {
                // Get contextual suggestions from memory
                const suggestions = await this.memorySystem.getContextualSuggestions({
                    filePath: currentFile,
                    language,
                    currentCode: selectedText
                });

                // Generate AI response
                const response = await this.generateAIResponse(
                    userQuery,
                    selectedText,
                    language,
                    suggestions
                );

                // Show response and options
                await this.showResponsePanel(response, selectedText, position);

                // Record interaction in memory
                await this.memorySystem.recordInteraction(
                    'interaction',
                    `Query: ${userQuery}\nResponse: ${response.explanation}`,
                    {
                        filePath: currentFile,
                        language
                    },
                    7 // Higher importance for inline chat
                );

            } catch (error) {
                vscode.window.showErrorMessage(`Inline chat failed: ${error}`);
            }
        });
    }

    private async generateAIResponse(
        query: string,
        code: string,
        language: string,
        suggestions: string[]
    ): Promise<{
        explanation: string;
        modifiedCode?: string;
        suggestions: string[];
    }> {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const prompt = `
You are an expert ${language} developer integrated in VS Code.

User Query: "${query}"

Selected Code:
\`\`\`${language}
${code}
\`\`\`

Context from Memory System:
${suggestions.join('\n')}

Please provide:
1. A clear explanation or answer to the user's query
2. If applicable, provide modified code
3. Any relevant suggestions or best practices

Format your response as JSON with:
- explanation: string
- modifiedCode: string (optional)
- suggestions: array of strings
`;

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
            // Fallback if response is not valid JSON
            return {
                explanation: content,
                suggestions: []
            };
        }
    }

    private async showResponsePanel(
        response: {
            explanation: string;
            modifiedCode?: string;
            suggestions: string[];
        },
        originalCode: string,
        position: vscode.Position
    ): Promise<void> {
        if (this.chatPanel) {
            this.chatPanel.dispose();
        }

        this.chatPanel = vscode.window.createWebviewPanel(
            'qoder-inline-chat',
            'Qoder AI Assistant',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.chatPanel.webview.html = this.getResponseHtml(response, originalCode);

        // Handle actions from webview
        this.chatPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'applyCode':
                    await this.applyCodeModification(message.code, position);
                    vscode.window.showInformationMessage('Code modification applied');
                    break;
                    
                case 'copyCode':
                    await vscode.env.clipboard.writeText(message.code);
                    vscode.window.showInformationMessage('Code copied to clipboard');
                    break;
                    
                case 'recordSuccess':
                    await this.memorySystem.recordInteraction(
                        'success',
                        'User applied AI-suggested code modification',
                        {
                            filePath: this.currentEditor?.document.fileName,
                            language: this.currentEditor?.document.languageId
                        },
                        8
                    );
                    break;
            }
        });
    }

    private getResponseHtml(
        response: {
            explanation: string;
            modifiedCode?: string;
            suggestions: string[];
        },
        originalCode: string
    ): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qoder AI Assistant</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        .ai-icon {
            font-size: 28px;
            margin-right: 10px;
        }
        .title {
            font-size: 20px;
            font-weight: 600;
        }
        .explanation {
            margin: 20px 0;
            padding: 20px;
            background: var(--vscode-inputValidation-infoBackground);
            border-radius: 8px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        .code-section {
            margin: 20px 0;
        }
        .code-header {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
        }
        .code-block {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            font-family: 'SF Mono', Consolas, monospace;
            font-size: 13px;
            overflow-x: auto;
            position: relative;
        }
        .code-actions {
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 8px;
        }
        button {
            padding: 6px 12px;
            font-size: 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
        }
        .btn-apply {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-copy {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button:hover {
            opacity: 0.8;
        }
        .suggestions {
            margin: 20px 0;
            padding: 15px;
            background: var(--vscode-input-background);
            border-radius: 6px;
        }
        .suggestions-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
        }
        .suggestion-item {
            margin: 8px 0;
            padding: 8px 12px;
            background: var(--vscode-inputOption-activeBackground);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-textLink-foreground);
            font-size: 13px;
        }
        .diff-added {
            background: rgba(40, 167, 69, 0.1);
            border-left: 3px solid #28a745;
        }
        .diff-removed {
            background: rgba(220, 53, 69, 0.1);
            border-left: 3px solid #dc3545;
            text-decoration: line-through;
            opacity: 0.6;
        }
        .learning-note {
            margin-top: 20px;
            padding: 10px;
            background: var(--vscode-inputValidation-warningBackground);
            border-radius: 4px;
            font-size: 12px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="ai-icon">🤖</span>
        <span class="title">Qoder AI Assistant</span>
    </div>

    <div class="explanation">
        ${response.explanation.replace(/\n/g, '<br>')}
    </div>

    ${response.modifiedCode ? `
        <div class="code-section">
            <div class="code-header">📝 Original Code:</div>
            <div class="code-block">
                <pre>${this.escapeHtml(originalCode)}</pre>
            </div>
        </div>

        <div class="code-section">
            <div class="code-header">✨ Modified Code:</div>
            <div class="code-block">
                <div class="code-actions">
                    <button class="btn-apply" onclick="applyCode()">Apply</button>
                    <button class="btn-copy" onclick="copyCode()">Copy</button>
                </div>
                <pre id="modifiedCode">${this.escapeHtml(response.modifiedCode)}</pre>
            </div>
        </div>
    ` : ''}

    ${response.suggestions.length > 0 ? `
        <div class="suggestions">
            <div class="suggestions-title">💡 Suggestions & Best Practices:</div>
            ${response.suggestions.map(suggestion => 
                `<div class="suggestion-item">${suggestion}</div>`
            ).join('')}
        </div>
    ` : ''}

    <div class="learning-note">
        🧠 This interaction has been recorded in your learning memory for future improvements.
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const modifiedCode = ${JSON.stringify(response.modifiedCode || '')};

        function applyCode() {
            vscode.postMessage({
                command: 'applyCode',
                code: modifiedCode
            });
            vscode.postMessage({ command: 'recordSuccess' });
        }

        function copyCode() {
            vscode.postMessage({
                command: 'copyCode',
                code: modifiedCode
            });
        }
    </script>
</body>
</html>
`;
    }

    private createInlineDecoration(position: vscode.Position): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ' 🤖',
                color: 'rgba(100, 200, 255, 0.8)',
                fontWeight: 'bold'
            }
        });
    }

    private async applyCodeModification(code: string, position: vscode.Position): Promise<void> {
        if (!this.currentEditor) return;

        const selection = this.currentEditor.selection;
        await this.currentEditor.edit(editBuilder => {
            editBuilder.replace(selection, code);
        });
    }

    private escapeHtml(text: string): string {
        const div = vscode.window.createWebviewPanel('temp', 'temp', vscode.ViewColumn.Active).webview;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}