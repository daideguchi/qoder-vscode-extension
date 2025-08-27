import * as vscode from 'vscode';
import { QuestManager, QuestSpec, QuestTask } from '../core/QuestManager';

export class QuestViewProvider implements vscode.TreeDataProvider<QuestItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<QuestItem | undefined | null | void> = new vscode.EventEmitter<QuestItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<QuestItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private questManager: QuestManager) {
        // Listen for quest changes
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: QuestItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: QuestItem): Thenable<QuestItem[]> {
        if (!element) {
            // Return root level - active quests
            return Promise.resolve(this.getQuests());
        } else if (element.contextValue === 'quest' && element.questId) {
            // Return tasks for this quest
            return Promise.resolve(this.getTasksForQuest(element.questId));
        }
        return Promise.resolve([]);
    }

    private getQuests(): QuestItem[] {
        const quests = this.questManager.getActiveQuests();
        return quests.map(quest => new QuestItem(
            quest.title,
            quest.status === 'completed' ? 
                vscode.TreeItemCollapsibleState.Collapsed : 
                vscode.TreeItemCollapsibleState.Expanded,
            {
                command: 'qoder.openQuest',
                title: 'Open Quest',
                arguments: [quest.id]
            },
            'quest',
            quest.id,
            this.getQuestIcon(quest.status),
            `${quest.tasks.filter(t => t.status === 'completed').length}/${quest.tasks.length} tasks completed`
        ));
    }

    private getTasksForQuest(questId: string): QuestItem[] {
        const quests = this.questManager.getActiveQuests();
        const quest = quests.find(q => q.id === questId);
        
        if (!quest) return [];

        return quest.tasks.map(task => new QuestItem(
            task.title,
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'qoder.openTask',
                title: 'Open Task',
                arguments: [questId, task.id]
            },
            'task',
            task.id,
            this.getTaskIcon(task.status),
            `${task.status} • ${task.filePaths.length} files`
        ));
    }

    private getQuestIcon(status: string): string {
        switch (status) {
            case 'draft': return '📝';
            case 'approved': return '✅';
            case 'in-progress': return '🚀';
            case 'completed': return '🎉';
            default: return '📋';
        }
    }

    private getTaskIcon(status: string): string {
        switch (status) {
            case 'pending': return '⏳';
            case 'in-progress': return '🔄';
            case 'completed': return '✅';
            default: return '📌';
        }
    }
}

export class QuestItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly contextValue?: string,
        public readonly questId?: string,
        public readonly icon?: string,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        
        this.tooltip = `${this.label}`;
        if (this.description) {
            this.tooltip += ` - ${this.description}`;
        }
        
        if (this.icon) {
            this.iconPath = new vscode.ThemeIcon('symbol-misc');
            // VS Code doesn't support emoji icons directly, using theme icon instead
        }
    }
}