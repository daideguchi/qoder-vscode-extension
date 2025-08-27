import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Database } from 'sqlite3';

export interface MemoryEntry {
    id: string;
    type: 'interaction' | 'mistake' | 'pattern' | 'preference' | 'success';
    content: string;
    context: {
        filePath?: string;
        language?: string;
        timestamp: Date;
        workspaceFolder?: string;
    };
    importance: number; // 1-10 scale
    tags: string[];
    embedding?: number[]; // For semantic search
}

export interface LearningPattern {
    id: string;
    pattern: string;
    description: string;
    examples: string[];
    frequency: number;
    lastUsed: Date;
    effectiveness: number; // 1-10 scale
}

export interface UserPreference {
    category: string;
    key: string;
    value: any;
    confidence: number; // How certain we are about this preference
    lastUpdated: Date;
}

export class MemorySystem {
    private context: vscode.ExtensionContext;
    private database: Database | null = null;
    private memoryPanel: vscode.WebviewPanel | null = null;
    private learningPatterns: Map<string, LearningPattern> = new Map();
    private userPreferences: Map<string, UserPreference> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async initialize(): Promise<void> {
        const dbPath = path.join(this.context.globalStoragePath, 'qoder_memory.db');
        
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.database = new Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.createTables().then(() => {
                    this.loadMemoryData().then(() => {
                        console.log('🧠 Memory system database initialized');
                        resolve();
                    });
                }).catch(reject);
            });
        });
    }

    private async createTables(): Promise<void> {
        if (!this.database) return;

        return new Promise((resolve, reject) => {
            const tables = [
                `CREATE TABLE IF NOT EXISTS memory_entries (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    file_path TEXT,
                    language TEXT,
                    timestamp TEXT NOT NULL,
                    workspace_folder TEXT,
                    importance INTEGER DEFAULT 5,
                    tags TEXT,
                    embedding TEXT
                )`,
                `CREATE TABLE IF NOT EXISTS learning_patterns (
                    id TEXT PRIMARY KEY,
                    pattern TEXT NOT NULL,
                    description TEXT NOT NULL,
                    examples TEXT,
                    frequency INTEGER DEFAULT 1,
                    last_used TEXT NOT NULL,
                    effectiveness INTEGER DEFAULT 5
                )`,
                `CREATE TABLE IF NOT EXISTS user_preferences (
                    category TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    confidence REAL DEFAULT 0.5,
                    last_updated TEXT NOT NULL,
                    PRIMARY KEY (category, key)
                )`,
                `CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type)`,
                `CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory_entries(timestamp)`,
                `CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_entries(importance)`
            ];

            let completed = 0;
            tables.forEach(sql => {
                this.database!.run(sql, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === tables.length) {
                        resolve();
                    }
                });
            });
        });
    }

    async recordInteraction(
        type: MemoryEntry['type'],
        content: string,
        context: Partial<MemoryEntry['context']> = {},
        importance: number = 5,
        tags: string[] = []
    ): Promise<void> {
        if (!this.database) return;

        const entry: MemoryEntry = {
            id: this.generateId(),
            type,
            content,
            context: {
                ...context,
                timestamp: new Date()
            },
            importance,
            tags
        };

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO memory_entries 
                (id, type, content, file_path, language, timestamp, workspace_folder, importance, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            this.database!.run(sql, [
                entry.id,
                entry.type,
                entry.content,
                entry.context.filePath || null,
                entry.context.language || null,
                entry.context.timestamp.toISOString(),
                entry.context.workspaceFolder || null,
                entry.importance,
                JSON.stringify(entry.tags)
            ], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Update learning patterns based on this interaction
                this.updateLearningPatterns(entry);
                resolve();
            });
        });
    }

    private async updateLearningPatterns(entry: MemoryEntry): Promise<void> {
        // Analyze the interaction to identify patterns
        const patterns = this.extractPatterns(entry);
        
        for (const patternData of patterns) {
            const existingPattern = this.learningPatterns.get(patternData.pattern);
            
            if (existingPattern) {
                existingPattern.frequency++;
                existingPattern.lastUsed = new Date();
                existingPattern.examples.push(entry.content);
                
                // Keep only recent examples (max 10)
                if (existingPattern.examples.length > 10) {
                    existingPattern.examples = existingPattern.examples.slice(-10);
                }
            } else {
                const newPattern: LearningPattern = {
                    id: this.generateId(),
                    pattern: patternData.pattern,
                    description: patternData.description,
                    examples: [entry.content],
                    frequency: 1,
                    lastUsed: new Date(),
                    effectiveness: 5
                };
                this.learningPatterns.set(newPattern.pattern, newPattern);
            }
        }
        
        await this.saveLearningPatterns();
    }

    private extractPatterns(entry: MemoryEntry): Array<{ pattern: string; description: string }> {
        const patterns: Array<{ pattern: string; description: string }> = [];
        const content = entry.content.toLowerCase();

        // Code pattern detection
        if (entry.context.language) {
            // Language-specific patterns
            if (content.includes('async') && content.includes('await')) {
                patterns.push({
                    pattern: `async_await_${entry.context.language}`,
                    description: `User frequently uses async/await in ${entry.context.language}`
                });
            }
            
            if (content.includes('interface') && entry.context.language === 'typescript') {
                patterns.push({
                    pattern: 'typescript_interfaces',
                    description: 'User prefers TypeScript interfaces for type definitions'
                });
            }
        }

        // Behavioral patterns
        if (entry.type === 'mistake') {
            const mistakeType = this.categorizeMistake(content);
            patterns.push({
                pattern: `mistake_${mistakeType}`,
                description: `Common mistake in ${mistakeType}`
            });
        }

        // Preference patterns
        if (content.includes('prefer') || content.includes('like')) {
            patterns.push({
                pattern: 'preference_expression',
                description: 'User expressed a preference'
            });
        }

        return patterns;
    }

    private categorizeMistake(content: string): string {
        if (content.includes('syntax')) return 'syntax';
        if (content.includes('type')) return 'typing';
        if (content.includes('import')) return 'imports';
        if (content.includes('async') || content.includes('promise')) return 'async';
        return 'general';
    }

    async getRelevantMemories(context: {
        filePath?: string;
        language?: string;
        query?: string;
    }): Promise<MemoryEntry[]> {
        if (!this.database) return [];

        return new Promise((resolve, reject) => {
            let sql = 'SELECT * FROM memory_entries WHERE 1=1';
            const params: any[] = [];

            if (context.language) {
                sql += ' AND language = ?';
                params.push(context.language);
            }

            if (context.filePath) {
                sql += ' AND file_path = ?';
                params.push(context.filePath);
            }

            // Order by importance and recency
            sql += ' ORDER BY importance DESC, timestamp DESC LIMIT 20';

            this.database!.all(sql, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const memories: MemoryEntry[] = rows.map(row => ({
                    id: row.id,
                    type: row.type,
                    content: row.content,
                    context: {
                        filePath: row.file_path,
                        language: row.language,
                        timestamp: new Date(row.timestamp),
                        workspaceFolder: row.workspace_folder
                    },
                    importance: row.importance,
                    tags: JSON.parse(row.tags || '[]')
                }));

                resolve(memories);
            });
        });
    }

    async getContextualSuggestions(context: {
        filePath?: string;
        language?: string;
        currentCode?: string;
    }): Promise<string[]> {
        const relevantMemories = await this.getRelevantMemories(context);
        const relevantPatterns = Array.from(this.learningPatterns.values())
            .filter(pattern => {
                if (context.language && pattern.pattern.includes(context.language)) {
                    return true;
                }
                return pattern.frequency > 2 && pattern.effectiveness > 6;
            })
            .sort((a, b) => (b.frequency * b.effectiveness) - (a.frequency * a.effectiveness))
            .slice(0, 5);

        const suggestions: string[] = [];

        // Generate suggestions based on patterns
        for (const pattern of relevantPatterns) {
            suggestions.push(`Based on your coding patterns: ${pattern.description}`);
        }

        // Generate suggestions based on past mistakes
        const mistakes = relevantMemories
            .filter(memory => memory.type === 'mistake')
            .slice(0, 3);

        for (const mistake of mistakes) {
            suggestions.push(`Remember: ${mistake.content}`);
        }

        return suggestions.slice(0, 8);
    }

    async showMemoryPanel(): Promise<void> {
        if (this.memoryPanel) {
            this.memoryPanel.reveal();
            return;
        }

        this.memoryPanel = vscode.window.createWebviewPanel(
            'qoder-memory',
            '🧠 Qoder Learning Memory',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.memoryPanel.onDidDispose(() => {
            this.memoryPanel = null;
        });

        await this.updateMemoryPanelContent();
    }

    private async updateMemoryPanelContent(): Promise<void> {
        if (!this.memoryPanel) return;

        const recentMemories = await this.getRecentMemories(20);
        const topPatterns = Array.from(this.learningPatterns.values())
            .sort((a, b) => (b.frequency * b.effectiveness) - (a.frequency * a.effectiveness))
            .slice(0, 10);

        this.memoryPanel.webview.html = this.getMemoryPanelHtml(recentMemories, topPatterns);
    }

    private async getRecentMemories(limit: number): Promise<MemoryEntry[]> {
        if (!this.database) return [];

        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM memory_entries ORDER BY timestamp DESC LIMIT ?';
            
            this.database!.all(sql, [limit], (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const memories: MemoryEntry[] = rows.map(row => ({
                    id: row.id,
                    type: row.type,
                    content: row.content,
                    context: {
                        filePath: row.file_path,
                        language: row.language,
                        timestamp: new Date(row.timestamp),
                        workspaceFolder: row.workspace_folder
                    },
                    importance: row.importance,
                    tags: JSON.parse(row.tags || '[]')
                }));

                resolve(memories);
            });
        });
    }

    private getMemoryPanelHtml(memories: MemoryEntry[], patterns: LearningPattern[]): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qoder Learning Memory</title>
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
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            margin: 0 0 10px 0;
            color: var(--vscode-textLink-foreground);
        }
        .subtitle {
            font-size: 14px;
            opacity: 0.8;
            margin: 0;
        }
        .section {
            margin: 30px 0;
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            margin: 0 0 15px 0;
            border-left: 3px solid var(--vscode-button-background);
            padding-left: 10px;
        }
        .memory-item, .pattern-item {
            margin: 10px 0;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid;
        }
        .memory-item {
            background: var(--vscode-inputValidation-infoBackground);
        }
        .memory-interaction { border-left-color: #4CAF50; }
        .memory-mistake { border-left-color: #f44336; }
        .memory-pattern { border-left-color: #2196F3; }
        .memory-preference { border-left-color: #FF9800; }
        .memory-success { border-left-color: #9C27B0; }
        
        .pattern-item {
            background: var(--vscode-input-background);
            border-left-color: var(--vscode-button-background);
        }
        .memory-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .memory-type {
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .type-interaction { background: #4CAF50; color: white; }
        .type-mistake { background: #f44336; color: white; }
        .type-pattern { background: #2196F3; color: white; }
        .type-preference { background: #FF9800; color: white; }
        .type-success { background: #9C27B0; color: white; }
        
        .memory-time {
            font-size: 12px;
            opacity: 0.6;
        }
        .memory-content {
            margin: 8px 0;
            font-size: 14px;
        }
        .memory-context {
            font-size: 12px;
            opacity: 0.7;
            font-family: 'SF Mono', Consolas, monospace;
            background: var(--vscode-terminal-background);
            padding: 4px 8px;
            border-radius: 3px;
            display: inline-block;
        }
        .pattern-stats {
            display: flex;
            gap: 15px;
            font-size: 12px;
            margin-top: 8px;
            opacity: 0.8;
        }
        .stat {
            background: var(--vscode-button-secondaryBackground);
            padding: 2px 6px;
            border-radius: 3px;
        }
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            opacity: 0.6;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">🧠 Learning Memory</h1>
        <p class="subtitle">Continuous improvement through AI memory</p>
    </div>

    <div class="section">
        <h2 class="section-title">📊 Learning Patterns</h2>
        ${patterns.length > 0 ? patterns.map(pattern => `
            <div class="pattern-item">
                <div class="memory-header">
                    <strong>${pattern.description}</strong>
                    <div class="pattern-stats">
                        <span class="stat">Used ${pattern.frequency}x</span>
                        <span class="stat">Effectiveness: ${pattern.effectiveness}/10</span>
                    </div>
                </div>
                <div class="memory-context">Pattern: ${pattern.pattern}</div>
            </div>
        `).join('') : '<div class="empty-state">No learning patterns detected yet. Keep using Qoder to build your AI memory!</div>'}
    </div>

    <div class="section">
        <h2 class="section-title">⏰ Recent Memory (${memories.length} entries)</h2>
        ${memories.length > 0 ? memories.map(memory => `
            <div class="memory-item memory-${memory.type}">
                <div class="memory-header">
                    <span class="memory-type type-${memory.type}">${memory.type}</span>
                    <span class="memory-time">${new Date(memory.context.timestamp).toLocaleString()}</span>
                </div>
                <div class="memory-content">${memory.content}</div>
                ${memory.context.filePath ? `<div class="memory-context">${memory.context.language || 'File'}: ${memory.context.filePath.split('/').pop()}</div>` : ''}
            </div>
        `).join('') : '<div class="empty-state">No memories recorded yet. Start using Qoder features to build your learning memory!</div>'}
    </div>
</body>
</html>
`;
    }

    private async loadMemoryData(): Promise<void> {
        // Load learning patterns from database
        if (!this.database) return;

        return new Promise((resolve) => {
            this.database!.all('SELECT * FROM learning_patterns', (err, rows: any[]) => {
                if (!err && rows) {
                    for (const row of rows) {
                        const pattern: LearningPattern = {
                            id: row.id,
                            pattern: row.pattern,
                            description: row.description,
                            examples: JSON.parse(row.examples || '[]'),
                            frequency: row.frequency,
                            lastUsed: new Date(row.last_used),
                            effectiveness: row.effectiveness
                        };
                        this.learningPatterns.set(pattern.pattern, pattern);
                    }
                }
                resolve();
            });
        });
    }

    private async saveLearningPatterns(): Promise<void> {
        if (!this.database) return;

        for (const pattern of this.learningPatterns.values()) {
            const sql = `INSERT OR REPLACE INTO learning_patterns 
                (id, pattern, description, examples, frequency, last_used, effectiveness)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            this.database.run(sql, [
                pattern.id,
                pattern.pattern,
                pattern.description,
                JSON.stringify(pattern.examples),
                pattern.frequency,
                pattern.lastUsed.toISOString(),
                pattern.effectiveness
            ]);
        }
    }

    private generateId(): string {
        return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    dispose(): void {
        if (this.database) {
            this.database.close();
        }
        this.memoryPanel?.dispose();
    }
}