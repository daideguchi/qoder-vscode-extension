# Qoder - AI Development Agent for VS Code

🚀 **Next-generation AI development agent inspired by Alibaba's Qoder, with full integration to dd unified system**

Qoder is a powerful VS Code extension that brings advanced AI-powered development features directly into your editor, including quest-driven development, continuous learning memory, automatic documentation, and seamless integration with your existing dd system.

## ✨ Core Features

### 🎯 Quest Mode - Spec-Driven Development
- **Command + E** to start a new development quest
- AI-powered requirement analysis and task breakdown
- Interactive specification approval workflow
- Automatic file generation and project structure

### 🧠 Continuous Learning Memory
- Learns from your coding patterns and mistakes
- Contextual suggestions based on past interactions
- Personal knowledge base that grows with you
- Integration with existing dd memory systems

### 📚 Repoki - Auto Wiki Generation  
- Automatically generates comprehensive project documentation
- Analyzes code structure, APIs, and architecture
- Creates searchable knowledge base
- Updates documentation as code evolves

### 🔍 Advanced Context Search
- Semantic search across your entire codebase
- Integration with external sources (Brave search)
- Memory-enhanced search results
- AI-powered result ranking and contextualization

### 💬 Inline AI Chat
- **Command + I** for context-aware AI assistance
- Real-time code explanation and modification
- Integration with learning memory for personalized help
- Direct code application with one click

## 🔗 DD System Integration

Qoder seamlessly integrates with your existing dd unified system:

### 🤖 Codex Integration
- Execute Codex tasks directly from VS Code
- Support for both quick (`cxl`) and marathon (`cxmarathon`) modes
- Automatic rate limit detection and handling
- Results displayed in new editor tabs

### 🎨 SuperClaude Framework
- Access to 21 specialized commands
- 14 domain-expert agents
- Integrated development workflow
- Professional code analysis and optimization

### 🎬 Media Generation
- **Canva Integration**: Generate project images and graphics
- **CapCut Integration**: Create project demo videos
- Automated media asset creation for documentation

### 📊 Data Management
- **Spreadsheet Integration**: Update project tracking sheets
- **Memory Synchronization**: Share learning patterns across systems
- **Global Search**: Search across all dd system memories

## 📦 Installation

### Prerequisites

1. **VS Code** (v1.85.0 or higher)
2. **Node.js** (v16 or higher)
3. **dd Unified System** (for full integration)

### Step 1: Clone and Build

```bash
# Clone the repository
cd /Users/dd
git clone qoder-vscode-extension
cd qoder-vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

### Step 2: Install Extension

```bash
# Package the extension
npm install -g vsce
vsce package

# Install in VS Code
code --install-extension qoder-vscode-extension-1.0.0.vsix
```

### Step 3: Configuration

1. Open VS Code Settings (`Cmd + ,`)
2. Search for "Qoder"
3. Configure the following settings:

```json
{
  "qoder.openai.apiKey": "your-openai-api-key",
  "qoder.memory.enabled": true,
  "qoder.autoWiki.enabled": true
}
```

**Note**: If you have the dd unified system installed, Qoder will automatically detect and use your existing API keys from `/Users/dd/.env`.

## 🚀 Quick Start

### 1. Start Your First Quest

1. Open a project in VS Code
2. Press **Command + E**
3. Describe what you want to build: *"Create a REST API for user authentication"*
4. Review and approve the AI-generated specification
5. Watch as Qoder breaks down tasks and guides implementation

### 2. Use Inline AI Chat

1. Select code in your editor
2. Press **Command + I**  
3. Ask questions or request modifications: *"Add error handling to this function"*
4. Apply AI suggestions directly to your code

### 3. Generate Project Wiki

1. Open Command Palette (`Cmd + Shift + P`)
2. Run **"Qoder: Generate Project Wiki (Repoki)"**
3. Comprehensive documentation will be created in `/wiki` folder

### 4. Advanced Context Search

1. Open Command Palette (`Cmd + Shift + P`)
2. Run **"Qoder: Advanced Context Search"**
3. Search across code, memory, and external sources simultaneously

## 🎯 DD System Integration Commands

If you have the dd unified system installed, access additional commands:

### Codex Commands
- **"Qoder DD: Execute Codex Task"** - Run development tasks with Codex
- Automatic detection of `cxl` and `cxmarathon` availability
- Rate limit handling and error recovery

### SuperClaude Commands  
- **"Qoder DD: Execute SuperClaude Command"** - Access 21 specialized commands
- Professional code analysis and optimization
- Domain-expert AI agents for specific tasks

### Media Generation
- **"Qoder DD: Generate Media"** - Create images with Canva or videos with CapCut
- Automated asset generation for project documentation
- Direct integration with existing media workflows

### System Status
- **"Qoder DD: DD System Status"** - Check integration status and available features

## 🎨 User Interface

### Explorer Panel Extensions

**Active Quests View**
- Visual quest progress tracking
- Expandable task lists with status indicators
- One-click task navigation

**Learning Memory View**  
- Recent interactions and patterns
- Learning effectiveness metrics
- Memory search and analysis

### Webview Panels

**Quest Specification Panel**
- Interactive requirement approval
- Task breakdown visualization  
- Progress tracking and file management

**Memory Panel**
- Learning pattern analytics
- Interaction history with filtering
- Memory-based suggestions

**Search Results Panel**
- Multi-source result aggregation
- Relevance scoring and ranking
- Direct file navigation

## ⚙️ Configuration Options

```json
{
  "qoder.openai.apiKey": "",
  "qoder.memory.enabled": true,
  "qoder.autoWiki.enabled": true,
  "qoder.contextSearch.includeExternal": true,
  "qoder.quest.autoApprove": false,
  "qoder.dd.systemPath": "/Users/dd",
  "qoder.dd.enableCodex": true,
  "qoder.dd.enableSuperClaude": true
}
```

## 🔧 Development

### Building from Source

```bash
# Install dependencies
npm install

# Start development watch
npm run watch

# Run extension in new VS Code window (F5)
# OR
code --extensionDevelopmentPath=/path/to/qoder-vscode-extension
```

### Testing

```bash
# Run tests
npm test

# Run linting
npm run lint
```

## 📚 Architecture

### Core Components

- **QuestManager**: Handles quest lifecycle and AI-powered task breakdown
- **MemorySystem**: Continuous learning and pattern recognition  
- **RepoWikiGenerator**: Automatic documentation generation
- **ContextSearchEngine**: Multi-source semantic search
- **DDSystemIntegration**: Bridge to existing dd unified system

### Data Flow

1. **User Input** → Quest/Chat/Search request
2. **AI Processing** → OpenAI GPT-4 analysis and generation
3. **Memory Integration** → Learning pattern application
4. **DD System Bridge** → External tool execution
5. **Result Display** → Webview panels and editor integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests and linting: `npm test && npm run lint`
5. Commit with descriptive message
6. Push and create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- Inspired by **Alibaba's Qoder** - the next-generation AI development agent
- Built on **OpenAI GPT-4** for advanced AI capabilities  
- Integrated with **dd Unified System** for comprehensive development workflow
- Uses **Brave Search API** for external knowledge integration

## 🚨 Security & Privacy

- All API keys stored locally in VS Code settings or dd system `.env`
- Learning data stored locally in SQLite database
- Optional external search can be disabled
- No code or personal data transmitted without explicit user action

## 📞 Support

- **Issues**: Report bugs and feature requests in GitHub Issues
- **Documentation**: Full documentation available in `/wiki` after generation
- **DD System Integration**: Ensure dd system is properly configured at `/Users/dd`

---

**🚀 Transform your development workflow with AI-powered quest-driven development!**

*Built with ❤️ for the modern AI-enhanced developer experience.*