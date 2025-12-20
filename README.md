# SecurePress

A Stream Deck plugin that adds Windows Hello biometric authentication to protect sensitive actions.

![SecurePress Logo](logo.png)

## Features

🔐 **Biometric Security** - Lock actions behind Windows Hello authentication (fingerprint, facial recognition, or PIN)

⚡ **Multiple Action Types:**
- Execute programs and applications
- Trigger keyboard hotkeys
- Run PowerShell and Python scripts
- Send HTTP requests (GET, POST, PUT, DELETE)
- Input text (paste or simulate typing)
- Execute multi-command sequences

🎨 **Visual Feedback** - Color-coded status indicators:
- 🟢 Green badge - Authentication successful
- 🔴 Red badge - Authentication failed
- 🟠 Orange badge - Authentication in progress
- ⚪ No badge - Idle state

## Installation

### From Stream Deck Marketplace
Coming soon!

### Manual Installation
1. Download the latest `com.securepress.action.streamDeckPlugin` from [Releases](https://github.com/yourusername/SecurePress/releases)
2. Double-click the file to install
3. The plugin will appear in Stream Deck's action list

## Development

### Prerequisites
- Node.js 20+
- npm
- Windows 10/11 with Windows Hello configured

### Setup
```bash
cd streamdeck-plugin
npm install
```

### Build
```bash
npm run build
```

### Package for Distribution
```bash
npm run build:package
```

### Install Locally for Testing
```bash
npm run install:local
```

See [DEVELOPMENT.md](streamdeck-plugin/DEVELOPMENT.md) for detailed development instructions.

## Requirements

- Windows 10/11
- Stream Deck software 6.4 or higher
- Windows Hello configured (fingerprint reader, camera for facial recognition, or PIN)

## License

MIT License - See [LICENSE](LICENSE) for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/yourusername/SecurePress/issues) page.
