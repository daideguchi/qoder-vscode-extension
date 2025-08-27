# 🧪 Qoder Extension Manual Testing Instructions

## Prerequisites Check ✅
- Extension installed: `dd-dev.qoder-vscode-extension@1.0.0`
- VS Code opened in project directory
- DD system integration: Available
- API keys configured in `/Users/dd/.env`

## 🎯 Test 1: Quest Mode (Command + E)

### Steps:
1. Open VS Code (should already be open)
2. Press `Cmd + E` or use Command Palette (`Cmd + Shift + P`)
3. Search for "Qoder: Start Quest"
4. Test input: "Create a user authentication system with JWT tokens"

### Expected Results:
- Input dialog appears
- Progress notification shows "AI is analyzing your requirements..."
- Webview panel opens with specification
- Task breakdown displayed with approve/modify/cancel options

## 🎯 Test 2: Inline Chat (Command + I)

### Steps:
1. Select some code in `test_project_sample.js`
2. Press `Cmd + I` or use "Qoder: Inline AI Chat"
3. Test input: "Add error handling to this function"

### Expected Results:
- Chat interface appears
- AI provides contextual suggestions
- Option to apply changes directly

## 🎯 Test 3: Wiki Generation

### Steps:
1. Command Palette (`Cmd + Shift + P`)
2. Run "Qoder: Generate Project Wiki (Repoki)"
3. Check for `/wiki` folder creation

### Expected Results:
- Wiki folder created with multiple markdown files
- Overview, API, Setup, Architecture documentation

## 🎯 Test 4: DD System Integration

### Steps:
1. Command Palette (`Cmd + Shift + P`)  
2. Run "Qoder DD: DD System Status"
3. Try "Qoder DD: Execute SuperClaude Command"

### Expected Results:
- Status panel shows DD system availability
- SuperClaude integration functional
- DD tools (ddsc, ddsheets, etc.) accessible

## 🎯 Test 5: Context Search

### Steps:
1. Command Palette (`Cmd + Shift + P`)
2. Run "Qoder: Advanced Context Search"
3. Test query: "authentication implementation"

### Expected Results:
- Search interface appears
- Results from code + external sources
- Relevance scoring displayed

## 🎯 Test 6: Memory System

### Steps:
1. Command Palette (`Cmd + Shift + P`)
2. Run "Qoder: Show Learning Memory"
3. Perform some actions and check if they're recorded

### Expected Results:
- Memory panel shows interaction history
- Learning patterns displayed
- SQLite database created in workspace

## 🔍 Debugging Steps

If any test fails:

### Check Extension Host Logs:
1. `Cmd + Shift + P` → "Developer: Reload Window"
2. `Cmd + Shift + P` → "Developer: Open Webview Developer Tools"
3. Check console for errors

### Check API Configuration:
```bash
# Verify API keys are available
source /Users/dd/.env
echo "OpenAI: $([ -n "$OPENAI_API_KEY" ] && echo '✅' || echo '❌')"
```

### Check DD Tools:
```bash
# Test DD system commands
/Users/dd/bin/ddsc --help
/Users/dd/bin/ddsheets --help
```

## 📊 Expected Test Results Summary

✅ **All tests should pass with:**
- No JavaScript errors in console
- Webview panels open properly
- DD system integration functional  
- API calls working (with valid keys)
- File operations successful
- Memory system recording interactions

❌ **Common issues to check:**
- API key not configured → Settings required
- DD system path incorrect → Check `/Users/dd/bin/`
- SQLite permissions → Check file system access
- Network issues → Check API connectivity

## 🎯 Success Criteria

Extension is fully functional when:
1. ✅ All 6 test scenarios work without errors
2. ✅ Webview panels display correctly  
3. ✅ DD system integration responds
4. ✅ API calls complete successfully
5. ✅ Files are created/modified as expected
6. ✅ No critical errors in extension host logs