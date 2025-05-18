# ngx-translate-assistant

A VS Code extension to supercharge your internationalization workflow for Angular projects using `@ngx-translate/core`.

## ✨ Features

- 🔍 Scans Angular templates for hardcoded strings
- 🛠 Extracts and replaces them with translation keys
- 📁 Automatically updates translation JSON files
- 🧭 Navigate to translation keys from templates
- 🧠 Key name generation based on context
- 🔧 Configurable path and language settings

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ngx-translate-assistant.git
cd ngx-translate-assistant
```

### 2. Install Dependencies
```bash
yarn install
# or
npm install
```

### 3. Launch Extension
```bash
code .
# Press F5 in VS Code to run Extension in Dev Host
```

## 🧪 Commands

Open Command Palette (`Ctrl+Shift+P`) and use:

- `NGX Translate: Scan Hardcoded Text` – scans `.html` files for hardcoded strings and extracts them to translation file.
- `NGX Translate: Go To Translation Key` – jumps to the key in your i18n file.

## ⚙️ Configuration
Add settings to your workspace or user `settings.json`:
```json
"ngxTranslateAssistant.translationPath": "src/assets/i18n",
"ngxTranslateAssistant.defaultLang": "en",
"ngxTranslateAssistant.licenseKey": "your-license-key-if-any"
```

## 📂 Folder Structure
```
src/
 ├── extension.ts           # Entry point
 ├── scanner.ts             # Extraction logic
 ├── navigation.ts          # Navigation to translation keys
 └── translationWriter.ts   # JSON writer helper
```

## 🔒 License & Monetization
Basic features are free and open source under MIT license. Premium version (Pro) will support:
- Google Translate integration
- Lokalise sync
- Key usage reports
- WebView translation editor

## 🧠 Roadmap
- [x] Hardcoded text scanner
- [x] JSON key extractor
- [x] Go to translation key
- [ ] Translation usage analyzer
- [ ] WebView-based translation editor
- [ ] XLIFF support

## 🛡 License
MIT © 2025 [Your Name]

---

Built with ❤️ for Angular developers who care about localization.
