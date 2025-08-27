import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DDSystemConfig {
    systemPath: string;
    envPath: string;
    binPath: string;
    sharedPath: string;
    codexAvailable: boolean;
    braveApiKey?: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    superClaudeAvailable: boolean;
}

export interface CodexResult {
    success: boolean;
    output: string;
    error?: string;
    executionTime: number;
}

export class DDSystemIntegration {
    private config: DDSystemConfig;
    private initialized = false;

    constructor() {
        this.config = {
            systemPath: '/Users/dd',
            envPath: '/Users/dd/.env',
            binPath: '/Users/dd/bin',
            sharedPath: '/Users/dd/shared',
            codexAvailable: false,
            superClaudeAvailable: false
        };
    }

    async initialize(): Promise<boolean> {
        try {
            // Check if DD system is available
            if (!fs.existsSync(this.config.systemPath)) {
                vscode.window.showWarningMessage('DD system not found. Some features will be limited.');
                return false;
            }

            // Load environment variables
            await this.loadEnvironmentVariables();

            // Check available tools
            await this.checkAvailableTools();

            this.initialized = true;
            vscode.window.showInformationMessage('🚀 DD System integration initialized successfully!');
            return true;

        } catch (error) {
            console.error('DD System integration failed:', error);
            vscode.window.showErrorMessage(`DD System integration failed: ${error}`);
            return false;
        }
    }

    private async loadEnvironmentVariables(): Promise<void> {
        if (!fs.existsSync(this.config.envPath)) {
            return;
        }

        try {
            const envContent = fs.readFileSync(this.config.envPath, 'utf-8');
            const lines = envContent.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, value] = trimmed.split('=');
                    if (key && value) {
                        switch (key.trim()) {
                            case 'BRAVE_API_KEY':
                                this.config.braveApiKey = value.trim();
                                break;
                            case 'OPENAI_API_KEY':
                                this.config.openaiApiKey = value.trim();
                                break;
                            case 'GEMINI_API_KEY':
                                this.config.geminiApiKey = value.trim();
                                break;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load environment variables:', error);
        }
    }

    private async checkAvailableTools(): Promise<void> {
        // Check Codex availability
        const codexCommands = ['cxl', 'cxmarathon'];
        for (const cmd of codexCommands) {
            const cmdPath = path.join(this.config.binPath, cmd);
            if (fs.existsSync(cmdPath)) {
                this.config.codexAvailable = true;
                break;
            }
        }

        // Check SuperClaude availability
        const superClaudePath = path.join(this.config.sharedPath, 'superclaude');
        if (fs.existsSync(superClaudePath)) {
            this.config.superClaudeAvailable = true;
        }
    }

    async executeCodex(
        task: string,
        mode: 'quick' | 'marathon' = 'quick',
        timeout = 30000
    ): Promise<CodexResult> {
        if (!this.config.codexAvailable) {
            throw new Error('Codex is not available in the DD system');
        }

        const command = mode === 'marathon' ? 'cxmarathon' : 'cxl';
        const cmdPath = path.join(this.config.binPath, command);

        const startTime = Date.now();
        
        try {
            // Check if Codex is rate limited
            const isLimited = await this.checkCodexRateLimit();
            if (isLimited) {
                return {
                    success: false,
                    output: '',
                    error: 'Codex is currently rate limited. Please try again later.',
                    executionTime: Date.now() - startTime
                };
            }

            const { stdout, stderr } = await execAsync(`"${cmdPath}" "${task}"`, { 
                timeout,
                cwd: this.config.systemPath,
                env: { ...process.env, PATH: `${this.config.binPath}:${process.env.PATH}` }
            });

            return {
                success: true,
                output: stdout,
                error: stderr || undefined,
                executionTime: Date.now() - startTime
            };

        } catch (error: any) {
            return {
                success: false,
                output: '',
                error: error.message || 'Unknown error occurred',
                executionTime: Date.now() - startTime
            };
        }
    }

    private async checkCodexRateLimit(): Promise<boolean> {
        try {
            // Quick test command to check if Codex is available
            await execAsync('echo "test" | head -1', { timeout: 5000 });
            return false;
        } catch (error: any) {
            // If the error message contains rate limit indicators
            if (error.message?.includes('usage limit') || error.message?.includes('rate limit')) {
                return true;
            }
            return false;
        }
    }

    async executeSuperClaudeCommand(command: string): Promise<string> {
        if (!this.config.superClaudeAvailable) {
            throw new Error('SuperClaude is not available in the DD system');
        }

        try {
            const ddscPath = path.join(this.config.binPath, 'ddsc');
            const { stdout } = await execAsync(`"${ddscPath}" ${command}`, {
                cwd: this.config.systemPath,
                timeout: 30000
            });

            return stdout;
        } catch (error: any) {
            throw new Error(`SuperClaude command failed: ${error.message}`);
        }
    }

    async searchWithBrave(query: string, count = 5): Promise<any[]> {
        if (!this.config.braveApiKey) {
            throw new Error('Brave API key not configured in DD system');
        }

        try {
            const response = await fetch(
                `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
                {
                    headers: {
                        'X-Subscription-Token': this.config.braveApiKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Brave search failed: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data.web?.results || [];

        } catch (error: any) {
            throw new Error(`Brave search failed: ${error.message}`);
        }
    }

    async generateWithCanva(
        title: string,
        subtitle: string,
        imageUrl?: string,
        preference: 'auto' | 'templated' | 'canva' = 'auto'
    ): Promise<any> {
        try {
            const ddcanvaPath = path.join(this.config.binPath, 'ddcanva');
            if (!fs.existsSync(ddcanvaPath)) {
                throw new Error('Canva integration not available');
            }

            const args = ['generate', `"${title}"`, `"${subtitle}"`];
            if (imageUrl) args.push(`"${imageUrl}"`);
            if (preference !== 'auto') args.push(`"${preference}"`);

            const { stdout } = await execAsync(`"${ddcanvaPath}" ${args.join(' ')}`, {
                cwd: this.config.systemPath,
                timeout: 60000
            });

            return JSON.parse(stdout);

        } catch (error: any) {
            throw new Error(`Canva generation failed: ${error.message}`);
        }
    }

    async createWithCapCut(
        title: string,
        videoUrl?: string,
        audioUrl?: string
    ): Promise<any> {
        try {
            const ddcapcutPath = path.join(this.config.binPath, 'ddcapcut');
            if (!fs.existsSync(ddcapcutPath)) {
                throw new Error('CapCut integration not available');
            }

            // Create new project
            await execAsync(`"${ddcapcutPath}" create`, {
                cwd: this.config.systemPath,
                timeout: 30000
            });

            // Add title
            await execAsync(`"${ddcapcutPath}" add_text "${title}" 0 3`, {
                cwd: this.config.systemPath,
                timeout: 30000
            });

            // Add video if provided
            if (videoUrl) {
                await execAsync(`"${ddcapcutPath}" add_video "${videoUrl}" 0 30`, {
                    cwd: this.config.systemPath,
                    timeout: 30000
                });
            }

            // Add audio if provided
            if (audioUrl) {
                await execAsync(`"${ddcapcutPath}" add_audio "${audioUrl}" 0 30`, {
                    cwd: this.config.systemPath,
                    timeout: 30000
                });
            }

            // Save project
            const { stdout } = await execAsync(`"${ddcapcutPath}" save`, {
                cwd: this.config.systemPath,
                timeout: 60000
            });

            return JSON.parse(stdout);

        } catch (error: any) {
            throw new Error(`CapCut creation failed: ${error.message}`);
        }
    }

    async updateSpreadsheet(
        spreadsheetId: string,
        data: string[],
        operation: 'write' | 'log' | 'create' = 'write'
    ): Promise<void> {
        try {
            const ddsheetsPath = path.join(this.config.binPath, 'ddsheets');
            if (!fs.existsSync(ddsheetsPath)) {
                throw new Error('Spreadsheet integration not available');
            }

            const args = [operation, `"${spreadsheetId}"`, ...data.map(d => `"${d}"`)];
            
            await execAsync(`"${ddsheetsPath}" ${args.join(' ')}`, {
                cwd: this.config.systemPath,
                timeout: 30000
            });

        } catch (error: any) {
            throw new Error(`Spreadsheet update failed: ${error.message}`);
        }
    }

    async searchMemorySystem(query: string): Promise<any[]> {
        const results: any[] = [];

        try {
            // Search global conversation memory
            const conversationMemoryPath = path.join(
                this.config.systemPath,
                'Desktop/1_dev/shared/conversation_memory'
            );

            if (fs.existsSync(conversationMemoryPath)) {
                const memoryResults = await this.searchDirectory(conversationMemoryPath, query);
                results.push(...memoryResults);
            }

            // Search technical records
            const technicalRecordsPath = path.join(
                this.config.systemPath,
                'projects/technical_records'
            );

            if (fs.existsSync(technicalRecordsPath)) {
                const techResults = await this.searchDirectory(technicalRecordsPath, query);
                results.push(...techResults);
            }

        } catch (error) {
            console.warn('Memory system search failed:', error);
        }

        return results;
    }

    private async searchDirectory(dirPath: string, query: string): Promise<any[]> {
        const results: any[] = [];
        const queryLower = query.toLowerCase();

        try {
            const files = fs.readdirSync(dirPath, { recursive: true });

            for (const file of files) {
                const filePath = path.join(dirPath, file.toString());
                const stat = fs.statSync(filePath);

                if (stat.isFile() && this.isTextFile(filePath)) {
                    try {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        if (content.toLowerCase().includes(queryLower)) {
                            results.push({
                                filePath,
                                content: this.extractRelevantSnippet(content, query),
                                lastModified: stat.mtime
                            });
                        }
                    } catch (error) {
                        // Skip files that can't be read
                        continue;
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to search directory ${dirPath}:`, error);
        }

        return results;
    }

    private isTextFile(filePath: string): boolean {
        const textExtensions = ['.md', '.txt', '.json', '.js', '.ts', '.py', '.html', '.css', '.yml', '.yaml'];
        const ext = path.extname(filePath).toLowerCase();
        return textExtensions.includes(ext);
    }

    private extractRelevantSnippet(content: string, query: string): string {
        const lines = content.split('\n');
        const queryLower = query.toLowerCase();

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
                const start = Math.max(0, i - 2);
                const end = Math.min(lines.length, i + 3);
                return lines.slice(start, end).join('\n');
            }
        }

        return content.substring(0, 200) + '...';
    }

    getConfig(): DDSystemConfig {
        return { ...this.config };
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}