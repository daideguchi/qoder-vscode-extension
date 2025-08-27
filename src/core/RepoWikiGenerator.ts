import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';

export interface FileAnalysis {
    path: string;
    type: 'file' | 'directory';
    language?: string;
    size: number;
    functions: FunctionInfo[];
    classes: ClassInfo[];
    imports: string[];
    exports: string[];
    description: string;
    complexity: number; // 1-10 scale
}

export interface FunctionInfo {
    name: string;
    parameters: string[];
    returnType?: string;
    description: string;
    lineStart: number;
    lineEnd: number;
    complexity: number;
}

export interface ClassInfo {
    name: string;
    methods: FunctionInfo[];
    properties: string[];
    extends?: string;
    implements?: string[];
    description: string;
    lineStart: number;
    lineEnd: number;
}

export interface ProjectStructure {
    name: string;
    rootPath: string;
    files: FileAnalysis[];
    directories: string[];
    packageInfo?: {
        name?: string;
        version?: string;
        description?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
    };
    gitInfo?: {
        branch: string;
        lastCommit?: string;
        remoteUrl?: string;
    };
    technologies: string[];
    architecture: string;
}

export class RepoWikiGenerator {
    private markdownParser: MarkdownIt;
    private supportedLanguages = new Set([
        'typescript', 'javascript', 'python', 'java', 'csharp', 
        'cpp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin'
    ]);

    constructor() {
        this.markdownParser = new MarkdownIt();
    }

    async generateProjectWiki(
        projectPath: string, 
        progress?: vscode.Progress<{ increment?: number; message?: string }>
    ): Promise<void> {
        progress?.report({ increment: 10, message: "Analyzing project structure..." });
        
        // Analyze the project
        const structure = await this.analyzeProject(projectPath);
        
        progress?.report({ increment: 30, message: "Generating documentation..." });
        
        // Generate wiki content
        const wikiContent = await this.generateWikiContent(structure);
        
        progress?.report({ increment: 20, message: "Creating wiki files..." });
        
        // Create wiki directory and files
        await this.createWikiFiles(projectPath, wikiContent);
        
        progress?.report({ increment: 40, message: "Wiki generation completed!" });
        
        // Open the main wiki file
        const wikiPath = path.join(projectPath, 'wiki', 'README.md');
        if (fs.existsSync(wikiPath)) {
            const doc = await vscode.workspace.openTextDocument(wikiPath);
            await vscode.window.showTextDocument(doc);
        }
    }

    private async analyzeProject(projectPath: string): Promise<ProjectStructure> {
        const structure: ProjectStructure = {
            name: path.basename(projectPath),
            rootPath: projectPath,
            files: [],
            directories: [],
            technologies: [],
            architecture: 'unknown'
        };

        // Read package.json or similar config files
        structure.packageInfo = await this.getPackageInfo(projectPath);
        structure.gitInfo = await this.getGitInfo(projectPath);

        // Scan directory structure
        const files = await this.scanDirectory(projectPath);
        
        // Analyze each file
        for (const filePath of files) {
            const relativePath = path.relative(projectPath, filePath);
            const analysis = await this.analyzeFile(filePath, relativePath);
            structure.files.push(analysis);
        }

        // Determine technologies and architecture
        structure.technologies = this.detectTechnologies(structure);
        structure.architecture = this.detectArchitecture(structure);

        return structure;
    }

    private async scanDirectory(dirPath: string, maxDepth: number = 5, currentDepth: number = 0): Promise<string[]> {
        if (currentDepth >= maxDepth) return [];
        
        const files: string[] = [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            // Skip common ignore patterns
            if (this.shouldIgnore(entry.name)) continue;

            if (entry.isDirectory()) {
                const subFiles = await this.scanDirectory(fullPath, maxDepth, currentDepth + 1);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private shouldIgnore(name: string): boolean {
        const ignorePatterns = [
            'node_modules', '.git', '.vscode', 'dist', 'build', 'out',
            '.DS_Store', 'Thumbs.db', '*.log', '.env', '.env.local',
            'coverage', '.nyc_output', '__pycache__', '*.pyc',
            '.idea', '.venv', 'venv', '.pytest_cache'
        ];

        return ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(name);
            }
            return name === pattern || name.startsWith(pattern);
        });
    }

    private async analyzeFile(filePath: string, relativePath: string): Promise<FileAnalysis> {
        const stats = fs.statSync(filePath);
        const language = this.detectLanguage(filePath);
        
        const analysis: FileAnalysis = {
            path: relativePath,
            type: 'file',
            language,
            size: stats.size,
            functions: [],
            classes: [],
            imports: [],
            exports: [],
            description: '',
            complexity: 1
        };

        // Only analyze code files
        if (language && this.supportedLanguages.has(language) && stats.size < 1024 * 1024) { // Max 1MB
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                await this.analyzeCode(content, language, analysis);
            } catch (error) {
                console.warn(`Failed to analyze ${filePath}:`, error);
            }
        }

        return analysis;
    }

    private async analyzeCode(content: string, language: string, analysis: FileAnalysis): Promise<void> {
        const lines = content.split('\n');
        
        switch (language) {
            case 'typescript':
            case 'javascript':
                this.analyzeTypeScript(lines, analysis);
                break;
            case 'python':
                this.analyzePython(lines, analysis);
                break;
            case 'java':
                this.analyzeJava(lines, analysis);
                break;
            default:
                this.analyzeGeneric(lines, analysis);
        }

        // Generate description based on analysis
        analysis.description = this.generateFileDescription(analysis);
        analysis.complexity = this.calculateComplexity(analysis);
    }

    private analyzeTypeScript(lines: string[], analysis: FileAnalysis): void {
        // Basic TypeScript/JavaScript analysis
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Imports
            if (line.startsWith('import ') || line.startsWith('from ')) {
                analysis.imports.push(line);
            }

            // Exports
            if (line.startsWith('export ')) {
                analysis.exports.push(line);
            }

            // Simple function detection
            const functionMatch = line.match(/function\s+(\w+)|(\w+)\s*\(/);
            if (functionMatch && !line.includes('//')) {
                analysis.functions.push({
                    name: functionMatch[1] || functionMatch[2] || 'unknown',
                    parameters: [],
                    description: '',
                    lineStart: i + 1,
                    lineEnd: i + 1,
                    complexity: 1
                });
            }

            // Simple class detection
            const classMatch = line.match(/class\s+(\w+)/);
            if (classMatch) {
                analysis.classes.push({
                    name: classMatch[1],
                    methods: [],
                    properties: [],
                    description: '',
                    lineStart: i + 1,
                    lineEnd: i + 1
                });
            }
        }
    }

    private analyzePython(lines: string[], analysis: FileAnalysis): void {
        // Basic Python analysis
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line || line.startsWith('#')) continue;

            // Imports
            if (line.startsWith('import ') || line.startsWith('from ')) {
                analysis.imports.push(line);
            }

            // Functions
            const functionMatch = line.match(/def\s+(\w+)/);
            if (functionMatch) {
                analysis.functions.push({
                    name: functionMatch[1],
                    parameters: [],
                    description: '',
                    lineStart: i + 1,
                    lineEnd: i + 1,
                    complexity: 1
                });
            }

            // Classes
            const classMatch = line.match(/class\s+(\w+)/);
            if (classMatch) {
                analysis.classes.push({
                    name: classMatch[1],
                    methods: [],
                    properties: [],
                    description: '',
                    lineStart: i + 1,
                    lineEnd: i + 1
                });
            }
        }
    }

    private analyzeJava(lines: string[], analysis: FileAnalysis): void {
        // Java analysis implementation
        this.analyzeGeneric(lines, analysis);
    }

    private analyzeGeneric(lines: string[], analysis: FileAnalysis): void {
        // Generic analysis for unsupported languages
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for function-like patterns
            const functionPatterns = [
                /function\s+(\w+)\s*\(/,
                /def\s+(\w+)\s*\(/,
                /(\w+)\s*\(.*\)\s*\{/,
                /(\w+)\s*=\s*function/,
                /(\w+)\s*=>\s*/
            ];

            for (const pattern of functionPatterns) {
                const match = line.match(pattern);
                if (match) {
                    analysis.functions.push({
                        name: match[1],
                        parameters: [],
                        description: '',
                        lineStart: i + 1,
                        lineEnd: i + 1,
                        complexity: 1
                    });
                    break;
                }
            }
        }
    }

    private detectLanguage(filePath: string): string | undefined {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.cc': 'cpp',
            '.cxx': 'cpp',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin'
        };
        return languageMap[ext];
    }

    private async getPackageInfo(projectPath: string): Promise<ProjectStructure['packageInfo']> {
        const packageJsonPath = path.join(projectPath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            try {
                const content = fs.readFileSync(packageJsonPath, 'utf-8');
                return JSON.parse(content);
            } catch (error) {
                console.warn('Failed to parse package.json:', error);
            }
        }

        return undefined;
    }

    private async getGitInfo(projectPath: string): Promise<ProjectStructure['gitInfo']> {
        // Basic git info extraction
        // In a real implementation, you might use a git library
        return undefined;
    }

    private detectTechnologies(structure: ProjectStructure): string[] {
        const technologies = new Set<string>();
        
        // From package.json
        if (structure.packageInfo?.dependencies) {
            const deps = Object.keys(structure.packageInfo.dependencies);
            for (const dep of deps) {
                if (dep.includes('react')) technologies.add('React');
                if (dep.includes('vue')) technologies.add('Vue.js');
                if (dep.includes('angular')) technologies.add('Angular');
                if (dep.includes('express')) technologies.add('Express.js');
                if (dep.includes('nest')) technologies.add('NestJS');
                if (dep.includes('next')) technologies.add('Next.js');
                if (dep.includes('typescript')) technologies.add('TypeScript');
            }
        }

        // From file extensions
        const languages = structure.files
            .map(f => f.language)
            .filter(Boolean) as string[];
        
        for (const lang of languages) {
            technologies.add(lang.charAt(0).toUpperCase() + lang.slice(1));
        }

        return Array.from(technologies);
    }

    private detectArchitecture(structure: ProjectStructure): string {
        const hasControllers = structure.files.some(f => f.path.includes('controller'));
        const hasServices = structure.files.some(f => f.path.includes('service'));
        const hasModels = structure.files.some(f => f.path.includes('model'));
        const hasComponents = structure.files.some(f => f.path.includes('component'));

        if (hasControllers && hasServices && hasModels) {
            return 'MVC (Model-View-Controller)';
        }

        if (hasComponents) {
            return 'Component-based';
        }

        if (structure.files.some(f => f.path.includes('src'))) {
            return 'Modular';
        }

        return 'Flat structure';
    }

    private generateFileDescription(analysis: FileAnalysis): string {
        const parts = [];

        if (analysis.functions.length > 0) {
            parts.push(`Contains ${analysis.functions.length} function(s)`);
        }

        if (analysis.classes.length > 0) {
            parts.push(`Defines ${analysis.classes.length} class(es)`);
        }

        if (analysis.imports.length > 0) {
            parts.push(`Imports ${analysis.imports.length} module(s)`);
        }

        return parts.join('. ') + '.';
    }

    private calculateComplexity(analysis: FileAnalysis): number {
        let complexity = 1;
        complexity += analysis.functions.length * 0.5;
        complexity += analysis.classes.length * 1;
        complexity += analysis.imports.length * 0.1;
        return Math.min(Math.round(complexity), 10);
    }

    private async generateWikiContent(structure: ProjectStructure): Promise<Record<string, string>> {
        const wiki: Record<string, string> = {};

        // Main README
        wiki['README.md'] = this.generateMainWiki(structure);

        // Architecture overview
        wiki['Architecture.md'] = this.generateArchitectureWiki(structure);

        // API documentation
        wiki['API.md'] = this.generateAPIWiki(structure);

        // File structure
        wiki['FileStructure.md'] = this.generateFileStructureWiki(structure);

        // Setup guide
        wiki['Setup.md'] = this.generateSetupWiki(structure);

        return wiki;
    }

    private generateMainWiki(structure: ProjectStructure): string {
        const techList = structure.technologies.map(tech => `- ${tech}`).join('\n');
        const totalFunctions = structure.files.reduce((sum, f) => sum + f.functions.length, 0);
        const totalClasses = structure.files.reduce((sum, f) => sum + f.classes.length, 0);
        const totalSize = structure.files.reduce((sum, f) => sum + f.size, 0);
        
        return `# ${structure.name}

## 📖 Project Overview

${structure.packageInfo?.description || 'A software project with automatic documentation.'}

## 🚀 Technologies

${techList}

## 🏗️ Architecture

**Architecture Pattern**: ${structure.architecture}

## 📊 Project Statistics

- **Total Files**: ${structure.files.length}
- **Functions**: ${totalFunctions}
- **Classes**: ${totalClasses}
- **Lines of Code**: ~${totalSize} bytes

## 📚 Documentation

- [Architecture Overview](Architecture.md)
- [API Documentation](API.md)
- [File Structure](FileStructure.md)
- [Setup Guide](Setup.md)

---
*This documentation was automatically generated by Qoder AI.*
`;
    }

    private generateArchitectureWiki(structure: ProjectStructure): string {
        const classFiles = structure.files.filter(f => f.classes.length > 0);
        const classInfo = classFiles.map(f => 
            `### ${f.path}\n${f.classes.map(c => 
                `- **${c.name}**: ${c.methods.length} methods, ${c.properties.length} properties`
            ).join('\n')}`
        ).join('\n\n');

        const dependencies = structure.packageInfo?.dependencies ? 
            Object.entries(structure.packageInfo.dependencies)
                .map(([name, version]) => `- ${name}: ${version}`)
                .join('\n') : 'No dependencies found.';

        return `# Architecture Overview

## System Design

**Architecture**: ${structure.architecture}

## Key Components

${classInfo || 'No class structures detected.'}

## Data Flow

${this.generateDataFlowDescription(structure)}

## Dependencies

${dependencies}
`;
    }

    private generateAPIWiki(structure: ProjectStructure): string {
        const apiFunctions = structure.files
            .flatMap(f => f.functions)
            .filter(func => func.name.includes('api') || func.name.includes('get') || func.name.includes('post'));

        const apiInfo = apiFunctions.length > 0 ? 
            apiFunctions.map(func => 
                `### ${func.name}\n- Parameters: ${func.parameters.join(', ') || 'None'}\n- Return Type: ${func.returnType || 'Unknown'}`
            ).join('\n\n') : 'No API endpoints detected automatically.';

        return `# API Documentation

## Endpoints

${apiInfo}

## Request/Response Examples

*Examples will be added as the API is used.*
`;
    }

    private generateFileStructureWiki(structure: ProjectStructure): string {
        const fileTree = this.buildFileTree(structure);
        const fileDetails = structure.files
            .filter(f => f.functions.length > 0 || f.classes.length > 0)
            .map(f => 
                `### ${f.path}\n- **Language**: ${f.language || 'Unknown'}\n- **Functions**: ${f.functions.length}\n- **Classes**: ${f.classes.length}\n- **Description**: ${f.description}`
            ).join('\n\n');

        return `# File Structure

## Directory Tree

\`\`\`
${fileTree}
\`\`\`

## File Details

${fileDetails}
`;
    }

    private generateSetupWiki(structure: ProjectStructure): string {
        const hasNode = structure.technologies.includes('Node.js');
        const hasPython = structure.technologies.includes('Python');
        const hasStart = structure.packageInfo?.scripts?.start;
        const hasDev = structure.packageInfo?.scripts?.dev;
        const configFiles = structure.files.filter(f => f.path.includes('config') || f.path.includes('.env'));

        return `# Setup Guide

## Prerequisites

${hasNode ? '- Node.js (v14 or higher)' : ''}
${hasPython ? '- Python (v3.8 or higher)' : ''}

## Installation

${structure.packageInfo?.scripts ? 
    `\`\`\`bash
npm install
\`\`\`` : ''}

## Running the Project

${hasStart ? 
    `\`\`\`bash
npm start
\`\`\`` : ''}

${hasDev ? 
    `\`\`\`bash
npm run dev
\`\`\`` : ''}

## Configuration

Check the following files for configuration options:
${configFiles.map(f => `- ${f.path}`).join('\n')}
`;
    }

    private buildFileTree(structure: ProjectStructure): string {
        // Simple file tree generation
        const paths = structure.files.map(f => f.path);
        return paths.slice(0, 20).join('\n'); // Limit for readability
    }

    private generateDataFlowDescription(structure: ProjectStructure): string {
        // Analyze imports/exports to understand data flow
        return 'Data flow analysis will be enhanced in future versions.';
    }

    private async createWikiFiles(projectPath: string, wikiContent: Record<string, string>): Promise<void> {
        const wikiDir = path.join(projectPath, 'wiki');
        
        // Create wiki directory
        if (!fs.existsSync(wikiDir)) {
            fs.mkdirSync(wikiDir, { recursive: true });
        }

        // Create wiki files
        for (const [fileName, content] of Object.entries(wikiContent)) {
            const filePath = path.join(wikiDir, fileName);
            fs.writeFileSync(filePath, content, 'utf-8');
        }

        // Add .gitignore entry if it doesn't exist
        const gitignorePath = path.join(projectPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
            if (!gitignoreContent.includes('wiki/')) {
                fs.appendFileSync(gitignorePath, '\n# Auto-generated wiki\nwiki/\n');
            }
        }
    }
}