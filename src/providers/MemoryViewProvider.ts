import * as vscode from 'vscode';
import { MemorySystem, MemoryEntry, LearningPattern } from '../core/MemorySystem';

export class MemoryViewProvider implements vscode.TreeDataProvider<MemoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MemoryItem | undefined | null | void> = new vscode.EventEmitter<MemoryItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MemoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private memorySystem: MemorySystem) {
        this.refresh();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.refresh();
        }, 30000);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MemoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MemoryItem): Promise<MemoryItem[]> {
        if (!element) {
            // Root level categories
            return [
                new MemoryItem(
                    'Recent Interactions',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'category',
                    '🕒',
                    'interactions'
                ),
                new MemoryItem(
                    'Learning Patterns',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'category',
                    '🧠',
                    'patterns'
                ),
                new MemoryItem(
                    'Common Mistakes',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'category',
                    '⚠️',
                    'mistakes'
                ),
                new MemoryItem(
                    'Success Stories',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'category',
                    '🎉',
                    'successes'
                )
            ];
        } else {
            // Category children
            switch (element.categoryType) {
                case 'interactions':
                    return this.getRecentInteractions();
                case 'patterns':
                    return this.getLearningPatterns();
                case 'mistakes':
                    return this.getMistakes();
                case 'successes':
                    return this.getSuccesses();
                default:
                    return [];
            }
        }
    }

    private async getRecentInteractions(): Promise<MemoryItem[]> {
        try {
            const memories = await this.memorySystem.getRelevantMemories({});
            return memories.slice(0, 10).map(memory => new MemoryItem(
                this.truncateText(memory.content, 50),
                vscode.TreeItemCollapsibleState.None,
                'memory',
                this.getMemoryIcon(memory.type),
                undefined,
                {
                    command: 'qoder.showMemoryDetail',
                    title: 'Show Memory Detail',
                    arguments: [memory]
                },
                this.getMemoryDescription(memory)
            ));
        } catch (error) {
            return [new MemoryItem(
                'Unable to load memories',
                vscode.TreeItemCollapsibleState.None,
                'error',
                '❌'
            )];
        }
    }

    private async getLearningPatterns(): Promise<MemoryItem[]> {
        // This would require accessing learning patterns from the memory system
        // For now, return sample patterns
        const patterns = [
            { pattern: 'async_await_usage', frequency: 15, effectiveness: 8 },
            { pattern: 'typescript_interfaces', frequency: 12, effectiveness: 9 },
            { pattern: 'error_handling', frequency: 8, effectiveness: 7 }
        ];

        return patterns.map(pattern => new MemoryItem(
            pattern.pattern.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            vscode.TreeItemCollapsibleState.None,
            'pattern',
            '📊',
            undefined,
            {
                command: 'qoder.showPatternDetail',
                title: 'Show Pattern Detail',
                arguments: [pattern]
            },
            `Used ${pattern.frequency}x • Effectiveness: ${pattern.effectiveness}/10`
        ));
    }

    private async getMistakes(): Promise<MemoryItem[]> {
        try {
            const memories = await this.memorySystem.getRelevantMemories({});
            const mistakes = memories.filter(m => m.type === 'mistake').slice(0, 5);
            
            return mistakes.map(mistake => new MemoryItem(
                this.truncateText(mistake.content, 40),
                vscode.TreeItemCollapsibleState.None,
                'mistake',
                '🔍',
                undefined,
                {
                    command: 'qoder.showMemoryDetail',
                    title: 'Show Mistake Detail',
                    arguments: [mistake]
                },
                mistake.context.language || 'General'
            ));
        } catch (error) {
            return [];
        }
    }

    private async getSuccesses(): Promise<MemoryItem[]> {
        try {
            const memories = await this.memorySystem.getRelevantMemories({});
            const successes = memories.filter(m => m.type === 'success').slice(0, 5);
            
            return successes.map(success => new MemoryItem(
                this.truncateText(success.content, 40),
                vscode.TreeItemCollapsibleState.None,
                'success',
                '⭐',
                undefined,
                {
                    command: 'qoder.showMemoryDetail',
                    title: 'Show Success Detail',
                    arguments: [success]
                },
                success.context.language || 'General'
            ));
        } catch (error) {
            return [];
        }
    }

    private getMemoryIcon(type: string): string {
        switch (type) {
            case 'interaction': return '💬';
            case 'mistake': return '⚠️';
            case 'pattern': return '📊';
            case 'preference': return '⚙️';
            case 'success': return '✨';
            default: return '📝';
        }
    }

    private getMemoryDescription(memory: MemoryEntry): string {
        const parts = [];
        
        if (memory.context.language) {
            parts.push(memory.context.language);
        }
        
        if (memory.importance > 7) {
            parts.push('High Priority');
        }
        
        const timeAgo = this.getTimeAgo(memory.context.timestamp);
        parts.push(timeAgo);

        return parts.join(' • ');
    }

    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    private getTimeAgo(date: Date): string {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return date.toLocaleDateString();
    }
}

export class MemoryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly icon?: string,
        public readonly categoryType?: string,
        public readonly command?: vscode.Command,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.label;
        if (this.description) {
            this.tooltip += ` - ${this.description}`;
        }
        
        // Set appropriate theme icons
        switch (this.contextValue) {
            case 'category':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'memory':
                this.iconPath = new vscode.ThemeIcon('note');
                break;
            case 'pattern':
                this.iconPath = new vscode.ThemeIcon('graph');
                break;
            case 'mistake':
                this.iconPath = new vscode.ThemeIcon('warning');
                break;
            case 'success':
                this.iconPath = new vscode.ThemeIcon('star');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('symbol-misc');
        }
    }
}