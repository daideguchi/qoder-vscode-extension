import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAI } from 'openai';

export interface SearchContext {
    query: string;
    workspacePath: string;
    currentFile?: string;
    language?: string;
    scope: 'workspace' | 'file' | 'function' | 'class';
    includeExternal: boolean; // Web search, documentation
    useSemanticSearch: boolean;
}

export interface SearchResult {
    id: string;
    type: 'code' | 'documentation' | 'external' | 'memory';
    title: string;
    content: string;
    filePath?: string;
    lineNumber?: number;
    relevanceScore: number;
    context: {
        language?: string;
        function?: string;
        class?: string;
        keywords: string[];
    };
    source: 'local' | 'web' | 'memory' | 'codex';
}

export interface SemanticIndex {
    id: string;
    content: string;
    filePath: string;
    embedding: number[];
    metadata: {
        type: 'function' | 'class' | 'comment' | 'import';
        language: string;
        keywords: string[];
        lastModified: Date;
    };
}

export class ContextSearchEngine {
    private context: vscode.ExtensionContext;
    private openai: OpenAI | null = null;
    private semanticIndex: Map<string, SemanticIndex> = new Map();
    private searchHistory: SearchResult[] = [];
    
    // Integration with existing systems
    private ddSystemPath = '/Users/dd';
    private braveApiKey: string | null = null;
    private codexIntegration = true;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeAI();
        this.loadExistingSystemIntegrations();
    }

    private initializeAI(): void {
        const config = vscode.workspace.getConfiguration('qoder');
        const apiKey = config.get<string>('openai.apiKey');
        
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    private async loadExistingSystemIntegrations(): Promise<void> {
        try {
            // Load dd system environment variables
            const envPath = path.join(this.ddSystemPath, '.env');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf-8');
                const braveMatch = envContent.match(/BRAVE_API_KEY=(.+)/);
                if (braveMatch) {
                    this.braveApiKey = braveMatch[1].trim();
                }
            }
        } catch (error) {
            console.warn('Failed to load dd system integrations:', error);
        }
    }

    async performSemanticSearch(query: string, workspacePath: string | null = null, options: Partial<SearchContext> = {}): Promise<void> {
        const searchContext: SearchContext = {
            query,
            workspacePath: workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            scope: workspacePath ? 'workspace' : 'file',
            includeExternal: true,
            useSemanticSearch: true,
            ...options
        };

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🔍 Performing advanced context search...",
                cancellable: true
            }, async (progress, token) => {
                const results: SearchResult[] = [];

                // Step 1: Local code search
                const localMessage = searchContext.workspacePath 
                    ? "Searching local codebase..." 
                    : "Searching current editor content...";
                progress.report({ increment: 20, message: localMessage });
                const localResults = await this.searchLocalCode(searchContext);
                results.push(...localResults);

                // Step 2: Memory system integration (existing dd system)
                progress.report({ increment: 20, message: "Querying learning memory..." });
                const memoryResults = await this.searchExistingMemory(searchContext);
                results.push(...memoryResults);

                // Step 3: External search (Brave API integration)
                if (searchContext.includeExternal && this.braveApiKey) {
                    progress.report({ increment: 20, message: "Searching external resources..." });
                    const externalResults = await this.searchExternal(searchContext);
                    results.push(...externalResults);
                }

                // Step 4: Codex enhancement
                if (this.codexIntegration) {
                    progress.report({ increment: 20, message: "Enhancing with Codex insights..." });
                    const codexResults = await this.enhanceWithCodex(searchContext, results);
                    results.push(...codexResults);
                }

                // Step 5: AI-powered result ranking and contextualization
                progress.report({ increment: 20, message: "Ranking and contextualizing results..." });
                const rankedResults = await this.rankAndContextualize(results, searchContext);

                // Show results
                await this.displaySearchResults(rankedResults, searchContext);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error}`);
        }
    }

    private async searchLocalCode(context: SearchContext): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        
        // If no workspace, search current editor content
        if (!context.workspacePath) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const content = activeEditor.document.getText();
                const fileName = path.basename(activeEditor.document.fileName);
                const matches = this.findContextualMatches(content, context.query);
                
                for (const match of matches) {
                    results.push({
                        id: `editor_${Date.now()}_${Math.random()}`,
                        type: 'code',
                        title: `${fileName}:${match.lineNumber}`,
                        content: match.content,
                        filePath: activeEditor.document.fileName,
                        lineNumber: match.lineNumber,
                        relevanceScore: match.score,
                        context: {
                            language: activeEditor.document.languageId,
                            keywords: match.keywords
                        },
                        source: 'local'
                    });
                }
            }
            return results;
        }

        try {
            // Use VS Code's built-in search capabilities
            const searchResults = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,java,cpp,go,rs,php,rb}',
                '**/node_modules/**'
            );

            for (const file of searchResults.slice(0, 50)) { // Limit for performance
                try {
                    const content = fs.readFileSync(file.fsPath, 'utf-8');
                    const matches = this.findContextualMatches(content, context.query);
                    
                    for (const match of matches) {
                        results.push({
                            id: `local_${Date.now()}_${Math.random()}`,
                            type: 'code',
                            title: `${path.basename(file.fsPath)}:${match.lineNumber}`,
                            content: match.content,
                            filePath: file.fsPath,
                            lineNumber: match.lineNumber,
                            relevanceScore: match.score,
                            context: {
                                language: this.detectLanguage(file.fsPath),
                                keywords: match.keywords
                            },
                            source: 'local'
                        });
                    }
                } catch (error) {
                    // Skip files that can't be read
                    continue;
                }
            }
        } catch (error) {
            console.warn('Local search failed:', error);
        }

        return results;
    }

    private async searchExistingMemory(context: SearchContext): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        try {
            // Integration with existing dd memory systems
            const memoryPaths = [
                path.join(this.ddSystemPath, 'Desktop/1_dev/shared/conversation_memory'),
                path.join(this.ddSystemPath, 'projects/technical_records'),
                path.join(this.ddSystemPath, 'data')  // cipher-sessions.db is here
            ];

            for (const memoryPath of memoryPaths) {
                if (fs.existsSync(memoryPath)) {
                    const memoryResults = await this.searchMemoryDirectory(memoryPath, context.query);
                    results.push(...memoryResults);
                }
            }

            // Search cipher database if available
            const cipherDbPath = path.join(this.ddSystemPath, 'data/cipher-sessions.db');
            if (fs.existsSync(cipherDbPath)) {
                const cipherResults = await this.searchCipherDatabase(cipherDbPath, context.query);
                results.push(...cipherResults);
            }

        } catch (error) {
            console.warn('Memory search failed:', error);
        }

        return results;
    }

    private async searchMemoryDirectory(memoryPath: string, query: string): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        
        try {
            const files = fs.readdirSync(memoryPath, { recursive: true });
            
            for (const file of files) {
                const filePath = path.join(memoryPath, file.toString());
                
                if (fs.statSync(filePath).isFile() && 
                    (filePath.endsWith('.md') || filePath.endsWith('.json') || filePath.endsWith('.txt'))) {
                    
                    const content = fs.readFileSync(filePath, 'utf-8');
                    if (content.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            id: `memory_${Date.now()}_${Math.random()}`,
                            type: 'memory',
                            title: `Memory: ${path.basename(filePath)}`,
                            content: this.extractRelevantSnippet(content, query),
                            filePath,
                            relevanceScore: this.calculateRelevance(content, query),
                            context: {
                                keywords: this.extractKeywords(content)
                            },
                            source: 'memory'
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to search memory directory ${memoryPath}:`, error);
        }

        return results;
    }

    private async searchCipherDatabase(dbPath: string, query: string): Promise<SearchResult[]> {
        // This would require sqlite3 integration in a real implementation
        // For now, return empty results
        return [];
    }

    private async searchExternal(context: SearchContext): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        if (!this.braveApiKey) return results;

        try {
            // Use Brave Search API (matching existing dd system integration)
            const searchQuery = `${context.query} ${context.language || ''} programming`;
            const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=5`, {
                headers: {
                    'X-Subscription-Token': this.braveApiKey
                }
            });

            if (response.ok) {
                const data = await response.json() as any;
                
                if (data.web?.results) {
                    for (const result of data.web.results) {
                        results.push({
                            id: `external_${Date.now()}_${Math.random()}`,
                            type: 'external',
                            title: result.title,
                            content: result.description,
                            relevanceScore: 0.7, // Default score for external results
                            context: {
                                keywords: this.extractKeywords(result.description)
                            },
                            source: 'web'
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('External search failed:', error);
        }

        return results;
    }

    private async enhanceWithCodex(context: SearchContext, existingResults: SearchResult[]): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        // Check if Codex is available via dd system
        try {
            const codexPath = path.join(this.ddSystemPath, 'bin');
            const codexCommands = ['cxl', 'cxmarathon'];
            
            for (const cmd of codexCommands) {
                const cmdPath = path.join(codexPath, cmd);
                if (fs.existsSync(cmdPath)) {
                    // Codex is available, enhance search with AI insights
                    const codexEnhancement = await this.getCodexEnhancement(context, existingResults);
                    if (codexEnhancement) {
                        results.push(codexEnhancement);
                    }
                    break;
                }
            }
        } catch (error) {
            console.warn('Codex enhancement failed:', error);
        }

        return results;
    }

    private async getCodexEnhancement(context: SearchContext, results: SearchResult[]): Promise<SearchResult | null> {
        if (!this.openai) return null;

        try {
            const prompt = `
Based on the search query "${context.query}" and these existing results:
${results.slice(0, 3).map(r => `- ${r.title}: ${r.content.substring(0, 100)}...`).join('\n')}

Provide a comprehensive code example or explanation that would help the developer.
Focus on practical implementation and best practices.
`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 1000
            });

            const enhancement = response.choices[0]?.message?.content;
            if (enhancement) {
                return {
                    id: `codex_${Date.now()}`,
                    type: 'code',
                    title: '🤖 AI-Generated Code Example',
                    content: enhancement,
                    relevanceScore: 0.9,
                    context: {
                        language: context.language,
                        keywords: this.extractKeywords(enhancement)
                    },
                    source: 'codex'
                };
            }
        } catch (error) {
            console.warn('Codex enhancement failed:', error);
        }

        return null;
    }

    private async rankAndContextualize(results: SearchResult[], context: SearchContext): Promise<SearchResult[]> {
        // Enhanced ranking algorithm considering:
        // 1. Relevance score
        // 2. Source reliability (local > memory > codex > external)
        // 3. Language match
        // 4. Recency (for memory items)

        const sourceWeights = {
            'local': 1.0,
            'memory': 0.9,
            'codex': 0.8,
            'web': 0.6
        };

        return results
            .map(result => ({
                ...result,
                relevanceScore: result.relevanceScore * sourceWeights[result.source] * 
                    (result.context.language === context.language ? 1.2 : 1.0)
            }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 20); // Top 20 results
    }

    private async displaySearchResults(results: SearchResult[], context: SearchContext): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'qoder-search-results',
            `🔍 Search: ${context.query}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getSearchResultsHtml(results, context);

        // Handle result clicks
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'openFile' && message.filePath && message.lineNumber) {
                const doc = await vscode.workspace.openTextDocument(message.filePath);
                const editor = await vscode.window.showTextDocument(doc);
                const position = new vscode.Position(message.lineNumber - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position));
            }
        });
    }

    private getSearchResultsHtml(results: SearchResult[], context: SearchContext): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qoder Search Results</title>
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
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .search-info {
            font-size: 18px;
            margin-bottom: 10px;
        }
        .result-count {
            font-size: 14px;
            opacity: 0.8;
        }
        .result {
            margin: 20px 0;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            border-left: 4px solid;
            background: var(--vscode-editor-background);
            cursor: pointer;
            transition: all 0.2s;
        }
        .result:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .result-code { border-left-color: #4CAF50; }
        .result-memory { border-left-color: #2196F3; }
        .result-external { border-left-color: #FF9800; }
        .result-documentation { border-left-color: #9C27B0; }
        
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .result-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }
        .result-meta {
            display: flex;
            gap: 10px;
            font-size: 12px;
        }
        .result-source {
            padding: 2px 6px;
            border-radius: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .source-local { background: #4CAF50; color: white; }
        .source-memory { background: #2196F3; color: white; }
        .source-web { background: #FF9800; color: white; }
        .source-codex { background: #9C27B0; color: white; }
        
        .result-score {
            opacity: 0.6;
        }
        .result-content {
            margin: 15px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .result-keywords {
            margin-top: 10px;
        }
        .keyword {
            display: inline-block;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            margin: 2px;
        }
        .code-snippet {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            font-family: 'SF Mono', Consolas, monospace;
            font-size: 13px;
            overflow-x: auto;
            margin: 10px 0;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            opacity: 0.6;
        }
        .ai-icon {
            font-size: 20px;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="search-info">🔍 Search Results for "${context.query}"</div>
        <div class="result-count">${results.length} results found • Enhanced with AI + Memory Integration</div>
    </div>

    ${results.length > 0 ? results.map(result => `
        <div class="result result-${result.type}" onclick="openResult('${result.filePath || ''}', ${result.lineNumber || 0})">
            <div class="result-header">
                <div class="result-title">
                    ${result.source === 'codex' ? '<span class="ai-icon">🤖</span>' : ''}
                    ${result.title}
                </div>
                <div class="result-meta">
                    <span class="result-source source-${result.source}">${result.source}</span>
                    <span class="result-score">Score: ${Math.round(result.relevanceScore * 100)}%</span>
                </div>
            </div>
            <div class="result-content">
                ${result.content.length > 300 ? 
                    `${result.content.substring(0, 300)}...` : 
                    result.content}
            </div>
            ${result.context.keywords?.length > 0 ? `
                <div class="result-keywords">
                    ${result.context.keywords.map(keyword => 
                        `<span class="keyword">${keyword}</span>`
                    ).join('')}
                </div>
            ` : ''}
        </div>
    `).join('') : `
        <div class="empty-state">
            <h3>No results found</h3>
            <p>Try adjusting your search query or check:</p>
            <ul>
                <li>Spelling and syntax</li>
                <li>Using different keywords</li>
                <li>Broadening your search scope</li>
            </ul>
        </div>
    `}

    <script>
        const vscode = acquireVsCodeApi();

        function openResult(filePath, lineNumber) {
            if (filePath && lineNumber > 0) {
                vscode.postMessage({
                    command: 'openFile',
                    filePath: filePath,
                    lineNumber: lineNumber
                });
            }
        }
    </script>
</body>
</html>
`;
    }

    // Helper methods
    private findContextualMatches(content: string, query: string): Array<{
        content: string;
        lineNumber: number;
        score: number;
        keywords: string[];
    }> {
        const lines = content.split('\n');
        const matches: Array<{content: string; lineNumber: number; score: number; keywords: string[]}> = [];
        const queryLower = query.toLowerCase();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();
            
            if (lineLower.includes(queryLower)) {
                // Include context (3 lines before and after)
                const contextStart = Math.max(0, i - 3);
                const contextEnd = Math.min(lines.length - 1, i + 3);
                const contextLines = lines.slice(contextStart, contextEnd + 1);
                
                matches.push({
                    content: contextLines.join('\n'),
                    lineNumber: i + 1,
                    score: this.calculateRelevance(line, query),
                    keywords: this.extractKeywords(line)
                });
            }
        }

        return matches;
    }

    private detectLanguage(filePath: string): string | undefined {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            '.ts': 'typescript', '.tsx': 'typescript',
            '.js': 'javascript', '.jsx': 'javascript',
            '.py': 'python', '.java': 'java',
            '.cpp': 'cpp', '.go': 'go',
            '.rs': 'rust', '.php': 'php'
        };
        return languageMap[ext];
    }

    private calculateRelevance(content: string, query: string): number {
        const contentLower = content.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Simple relevance calculation
        let score = 0;
        if (contentLower.includes(queryLower)) score += 0.5;
        
        // Bonus for exact matches
        if (contentLower === queryLower) score += 0.3;
        
        // Bonus for function/class definitions
        if (contentLower.includes('function') || contentLower.includes('class')) score += 0.2;
        
        return Math.min(score, 1.0);
    }

    private extractKeywords(content: string): string[] {
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.isStopWord(word));
        
        return [...new Set(words)].slice(0, 5);
    }

    private extractRelevantSnippet(content: string, query: string): string {
        const sentences = content.split(/[.!?]+/);
        const queryLower = query.toLowerCase();
        
        for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(queryLower)) {
                return sentence.trim() + '.';
            }
        }
        
        return content.substring(0, 200) + '...';
    }

    private isStopWord(word: string): boolean {
        const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'as', 'are', 'was', 'will', 'be']);
        return stopWords.has(word);
    }
}