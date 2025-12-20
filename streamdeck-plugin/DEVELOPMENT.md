# SecurePress - Development Guide

## 🛠️ Development Workflow

### Initial Setup
```bash
npm install
```

### Development Commands

#### 1. Build Plugin
```bash
npm run build
```
Compiles TypeScript and copies assets to `com.securepress.action.sdPlugin/`

#### 2. Package for Distribution
```bash
npm run package
```
Creates `com.securepress.action.streamDeckPlugin` file for distribution

#### 3. Build + Package
```bash
npm run build:package
```
Builds and packages in one command

#### 4. Install Locally for Testing
```bash
npm run install:local
```
- Builds the plugin
- Packages it
- Closes Stream Deck
- Installs to local plugins directory
- **Now you can open Stream Deck and test!**

#### 5. Watch Mode (Development)
```bash
npm run watch
```
Auto-compiles TypeScript on file changes (still need to reinstall manually)

## 📦 Distribution

### Local Testing
Use `npm run install:local` - this is the fastest way to test changes.

### Manual Installation
1. Build and package: `npm run build:package`
2. Double-click `com.securepress.action.streamDeckPlugin`
3. Stream Deck will install it automatically

### Store Distribution
1. Create release package: `npm run build:package`
2. Upload `com.securepress.action.streamDeckPlugin` to Stream Deck Marketplace
3. File is ready to distribute!

## 🔄 Complete Development Cycle

```bash
# 1. Make changes to src/plugin.ts or ui/property-inspector.html
# 2. Install and test
npm run install:local
# 3. Open Stream Deck and test your changes
# 4. Repeat!
```

## 📁 Project Structure

```
streamdeck-plugin/
├── src/
│   ├── plugin.ts              # Main plugin code
│   ├── windows-hello-auth.ts  # Windows Hello authentication
│   └── debug-logger.ts        # Debug logging
├── ui/
│   └── property-inspector.html # Settings UI
├── imgs/                       # Icon assets
├── scripts/
│   ├── generate-icons.js      # Generate PNG icons from SVG
│   ├── copy-assets.js         # Copy files to build directory
│   ├── package-plugin.js      # Create .streamDeckPlugin package
│   └── install-local.js       # Install for local testing
└── com.securepress.action.sdPlugin/  # Build output (installed version)
```

## 🐛 Debugging

### View Logs
Logs are in: `%APPDATA%\Elgato\StreamDeck\logs\com.securepress.action0.log`

### Debug Mode
Check `src/debug-logger.ts` for debug output. Logs show in the Stream Deck log files.

### Common Issues

**Plugin not updating?**
- Make sure Stream Deck is closed before running `npm run install:local`
- Check if another process has locked the plugin files

**Settings not saving?**
- Check property inspector console (right-click property inspector → Inspect)
- Verify WebSocket connection in browser console

**Action not executing?**
- Check Windows Hello is configured
- Verify action settings are saved
- Check log files for errors

## 🚀 Adding New Features

### New Action Type
1. Add to `Settings` interface in `src/plugin.ts`
2. Add case in `executeConfiguredAction()` switch
3. Implement `execute{Type}Action()` function
4. Add UI in `ui/property-inspector.html`
5. Add event listeners in property inspector JavaScript
6. Test with `npm run install:local`

### New Sequence Action
Add case in `executeSequenceAction()` switch to support new type in sequences.

## 📋 Checklist Before Publishing

- [ ] Test all action types (program, hotkey, script, HTTP, text, sequence)
- [ ] Test Windows Hello authentication
- [ ] Test with different Stream Deck models
- [ ] Update version in `manifest.json`
- [ ] Update version in `package.json`
- [ ] Test installation via `.streamDeckPlugin` file
- [ ] Create release package: `npm run build:package`
- [ ] Test the packaged version
- [ ] Create GitHub release with `.streamDeckPlugin` file
