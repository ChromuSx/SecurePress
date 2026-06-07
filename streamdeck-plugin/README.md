# SecurePress

A Stream Deck plugin that protects your actions with Windows Hello authentication (PIN, fingerprint, facial recognition).

## 🌟 Features

### Windows Hello Integration
- **Layered Authentication Methods**: SecurePress helper + native passport-desktop + PowerShell fallback
- **Multiple Auth Types**: PIN, Fingerprint, Facial Recognition
- **Session Caching**: Optional authentication memory (1-60 minutes)
- **Flexible Security**: Require auth every time or use cached sessions
- **Foreground Prompting**: Windows Hello is attached to the active window to avoid losing focus during text input

### Action Types
1. **Execute Program** - Launch applications with arguments
2. **Simulate Hotkey** - Send keyboard combinations (Ctrl+Alt+S, etc.)
3. **Execute Script** - Run PowerShell, Batch, or Python scripts
4. **HTTP Request** - Make GET/POST/PUT/DELETE requests with custom headers
5. **Multi-Command Sequence** - Chain multiple actions with delays

### User Experience
- **Visual Feedback**: 4 states (Idle, Authenticating, Success, Error)
- **Audio Feedback**: Windows system sounds for success/failure
- **Modern UI**: Stream Deck-styled configuration interface
- **Error Handling**: Clear error messages and logging

## 📋 Requirements

- **OS**: Windows 10/11
- **Windows Hello**: Must be configured (PIN, Fingerprint, or Face)
- **Stream Deck**: Software version 6.9 or later
- **Node.js**: Version 20+ (for development)
- **.NET Runtime**: Not required for packaged installs; the helper is published self-contained

## 🚀 Installation

### For Users

1. Download `com.securepress.action.streamDeckPlugin` from releases
2. Double-click the file to install
3. Restart Stream Deck software if needed
4. Find "SecurePress" in the actions list

### For Developers

```bash
# Clone/navigate to project
cd streamdeck-plugin

# Install dependencies
npm install

# Build the plugin
npm run build

# Create .streamDeckPlugin package
npm run package

# Install to Stream Deck
# Double-click the generated .streamDeckPlugin file
```

## 🎯 Usage

### Basic Setup

1. **Add Action**: Drag "Secure Action" from Stream Deck actions to a key
2. **Choose Type**: Select action type (Program, Hotkey, Script, etc.)
3. **Configure**: Fill in required parameters for your action type
4. **Set Auth**: Choose authentication frequency
5. **Test**: Press the button and authenticate!

### Action Type Examples

#### Execute Program
```
Program Path: C:\Program Files\OBS Studio\bin\64bit\obs64.exe
Arguments: --startrecording
```

#### Simulate Hotkey
```
Hotkey: Ctrl+Alt+M
```
Supports: Ctrl, Alt, Shift, Win, F1-F24, Enter, Tab, Arrow keys, etc.

#### Execute Script (PowerShell)
```powershell
Write-Host "Starting stream mode..."
Stop-Process -Name Discord -Force
Start-Process "obs64.exe" -ArgumentList "--startstreaming"
```

#### HTTP Request
```
URL: http://localhost:8080/api/lights/on
Method: POST
Body: {"brightness": 100, "color": "blue"}
Headers: {"X-Local-Action": "lights-on"}
```

#### Multi-Command Sequence
```json
[
  {
    "type": "program",
    "programPath": "C:\\OBS\\obs64.exe",
    "programArgs": "--startrecording"
  },
  {
    "type": "delay",
    "delayMs": 2000
  },
  {
    "type": "hotkey",
    "hotkeyKeys": "Ctrl+M"
  },
  {
    "type": "http",
    "httpUrl": "http://localhost:8080/start",
    "httpMethod": "POST"
  }
]
```

### Authentication Options

- **Require auth every time**: Maximum security, prompt on every press
- **Session duration**: Cache authentication for 1-60 minutes

## 🛠️ Development

### Project Structure

```
streamdeck-plugin/
├── src/
│   ├── plugin.ts                 # Main plugin logic
│   └── windows-hello-auth.ts     # Windows Hello integration
├── ui/
│   └── property-inspector.html   # Configuration UI
├── imgs/                          # Plugin icons
├── scripts/
│   ├── copy-assets.js            # Build script
│   └── package-plugin.js         # Packaging script
├── com.securepress.action.sdPlugin/  # Built plugin
├── package.json
├── tsconfig.json
└── README.md
```

### Build Commands

```bash
# Development
npm run build        # Compile TypeScript + copy assets
npm run watch        # Watch mode for development
npm test             # Compile TypeScript + run automated tests

# Packaging
npm run package      # Create .streamDeckPlugin file

# Full workflow
npm install          # Install deps
npm run build        # Build
npm run package      # Package
# Then double-click .streamDeckPlugin to install
```

### Windows Hello Implementation

SecurePress uses a layered approach for maximum compatibility:

1. **Primary**: `SecurePress.AuthHelper.exe`, a small self-contained Windows helper that owns the Windows Hello prompt correctly.
2. **Secondary**: `passport-desktop` native authentication.
3. **Fallback**: PowerShell + Windows Runtime APIs.

This ensures authentication works even if native bindings fail.

## ⚠️ Important Notes

### Sensitive Settings

SecurePress redacts sensitive values from debug logs and stores sensitive action fields outside Stream Deck settings using Windows DPAPI. Stream Deck settings keep only DPAPI references. These secrets are tied to the current Windows user profile and are not portable to another account or machine.

### Icons Required

Before packaging for distribution, add icons to `imgs/` directory:
- See `imgs/README.md` for required icons and dimensions
- Placeholder icons are currently in place

### Windows Hello Setup

Users must have Windows Hello configured:
```
Settings → Accounts → Sign-in options → Windows Hello
```

### Permissions

Stream Deck plugins run with user permissions. Actions that require admin rights won't work unless Stream Deck itself runs as admin.

### Testing

Test all authentication methods:
- PIN
- Fingerprint (if hardware available)
- Facial recognition (if hardware available)

## 🐛 Troubleshooting

### "Windows Hello not available"
- Ensure Windows Hello is set up in Windows Settings
- Check that your device supports biometric hardware
- Try using PIN as fallback

### "Authentication failed"
- Check Windows Hello is working in other apps
- Verify no group policy restrictions
- Restart Stream Deck software

### Action doesn't execute
- Check Stream Deck logs (Help → Open Logs Folder)
- Verify file paths are correct and absolute
- Test action parameters outside of SecurePress first

### Build errors
```bash
# Clean and rebuild
rm -rf node_modules bin com.securepress.action.sdPlugin
npm install
npm run build
```

## 📝 TODO / Future Enhancements

- [ ] Add custom icons (currently placeholders)
- [ ] Visual sequence builder in Property Inspector
- [ ] Import/export action configurations
- [ ] Action templates library
- [ ] Multi-language support
- [ ] Marketplace submission

## 🤝 Contributing

Contributions welcome! Areas needing help:
- Icon design (security/lock theme)
- Additional action types
- Testing on different Windows configurations
- Documentation improvements

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Credits

- Built with Elgato Stream Deck SDK
- Windows Hello integration via `passport-desktop`
- Inspired by the need for secure streaming workflows

---

**Made with 🔒 by [ChromuSx](https://github.com/ChromuSx)**

For support, open an issue on GitHub.
