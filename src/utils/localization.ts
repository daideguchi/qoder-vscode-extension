import * as vscode from 'vscode';

/**
 * Localization utility for Qoder extension
 * Provides consistent message handling across the extension
 */
export class LocalizationManager {
    
    /**
     * Get localized message using VS Code's built-in l10n API
     * Falls back to English if localization is not available
     */
    static getMessage(key: string, ...args: (string | number)[]): string {
        try {
            // Use VS Code's localization API if available (VS Code 1.73+)
            if (vscode.l10n) {
                return vscode.l10n.t(key, ...args);
            }
        } catch (error) {
            // Fallback for older VS Code versions
            console.warn('Localization not available, using fallback messages');
        }
        
        // Fallback messages in English
        return LocalizationManager.getFallbackMessage(key, ...args);
    }
    
    /**
     * Get current locale
     */
    static getCurrentLocale(): string {
        return vscode.env.language || 'en';
    }
    
    /**
     * Check if current locale is Japanese
     */
    static isJapanese(): boolean {
        return LocalizationManager.getCurrentLocale().startsWith('ja');
    }
    
    /**
     * Fallback messages for older VS Code versions
     */
    private static getFallbackMessage(key: string, ...args: (string | number)[]): string {
        const isJa = LocalizationManager.isJapanese();
        
        const messages: { [key: string]: { en: string; ja: string } } = {
            // Quest-related messages
            'quest.input.prompt': {
                en: 'Describe what you want to develop',
                ja: '開発したい内容を説明してください'
            },
            'quest.input.placeholder': {
                en: 'e.g., Create a REST API for user authentication with JWT tokens',
                ja: '例：JWT トークンを使用したユーザー認証 REST API を作成'
            },
            'quest.progress.analyzing': {
                en: '🤖 AI is analyzing your requirements...',
                ja: '🤖 AI が要件を分析しています...'
            },
            'quest.progress.generating': {
                en: 'Generating specification...',
                ja: '仕様を生成中...'
            },
            'quest.progress.tasks': {
                en: 'Breaking down into tasks...',
                ja: 'タスクに分解中...'
            },
            'quest.success.created': {
                en: '🚀 Quest approved and started!',
                ja: '🚀 クエストが承認され、開始されました！'
            },
            'quest.success.cancelled': {
                en: 'Quest cancelled',
                ja: 'クエストがキャンセルされました'
            },
            
            // Memory-related messages
            'memory.panel.title': {
                en: 'Learning Memory',
                ja: '学習メモリ'
            },
            'memory.interaction.recorded': {
                en: 'Interaction recorded in memory system',
                ja: 'インタラクションがメモリシステムに記録されました'
            },
            
            // Wiki generation messages
            'wiki.generation.started': {
                en: 'Generating project wiki...',
                ja: 'プロジェクト Wiki を生成中...'
            },
            'wiki.generation.completed': {
                en: 'Project wiki generated successfully in /wiki folder',
                ja: 'プロジェクト Wiki が /wiki フォルダに正常に生成されました'
            },
            
            // DD System integration messages
            'dd.status.checking': {
                en: 'Checking DD system status...',
                ja: 'DD システムの状態を確認中...'
            },
            'dd.codex.executing': {
                en: 'Executing Codex task...',
                ja: 'Codex タスクを実行中...'
            },
            'dd.superclaude.executing': {
                en: 'Executing SuperClaude command...',
                ja: 'SuperClaude コマンドを実行中...'
            },
            
            // Error messages
            'error.openai.not.configured': {
                en: 'OpenAI API key not configured. Please set qoder.openai.apiKey in settings.',
                ja: 'OpenAI API キーが設定されていません。設定で qoder.openai.apiKey を設定してください。'
            },
            'error.dd.system.not.found': {
                en: 'DD system not found. Some features will be limited.',
                ja: 'DD システムが見つかりません。一部の機能が制限されます。'
            },
            'error.quest.creation.failed': {
                en: 'Quest creation failed',
                ja: 'クエスト作成に失敗しました'
            },
            
            // Success messages
            'success.dd.integration.initialized': {
                en: '🚀 DD System integration initialized successfully!',
                ja: '🚀 DD システム統合が正常に初期化されました！'
            }
        };
        
        const messageSet = messages[key];
        if (!messageSet) {
            return key; // Return key if no message found
        }
        
        let message = isJa ? messageSet.ja : messageSet.en;
        
        // Replace placeholders if args provided
        args.forEach((arg, index) => {
            message = message.replace(`{${index}}`, String(arg));
        });
        
        return message;
    }
    
    /**
     * Show localized information message
     */
    static showInfo(key: string, ...args: (string | number)[]): Thenable<string | undefined> {
        return vscode.window.showInformationMessage(LocalizationManager.getMessage(key, ...args));
    }
    
    /**
     * Show localized warning message
     */
    static showWarning(key: string, ...args: (string | number)[]): Thenable<string | undefined> {
        return vscode.window.showWarningMessage(LocalizationManager.getMessage(key, ...args));
    }
    
    /**
     * Show localized error message
     */
    static showError(key: string, ...args: (string | number)[]): Thenable<string | undefined> {
        return vscode.window.showErrorMessage(LocalizationManager.getMessage(key, ...args));
    }
}