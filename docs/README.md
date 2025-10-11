# CPH-NG Documentation

Welcome to the CPH-NG documentation! This comprehensive guide covers everything you need to know about using CPH-NG for competitive programming.

## 📚 Documentation Overview

### For New Users

Start here if you're new to CPH-NG:

1. **[Overview](index.md)** - Learn what CPH-NG is and its key features
2. **[Quick Start](quickStart.md)** - Get up and running in minutes
3. **[FAQ](faq.md)** - Common questions and answers

### For Regular Users

Explore features and customize your experience:

4. **[Feature Guide](features.md)** - Comprehensive guide to all features (20KB+)
5. **[Configuration](configuration.md)** - Complete settings reference (21KB+)
6. **[Modules](modules.md)** - Additional functionality

### For Contributors

Learn about the project:

7. **[About](about.md)** - Project information and contributing guidelines

## 🌍 Languages

Documentation is available in:

- **English** (default)
- **简体中文** (Chinese Simplified)

Switch languages using the language selector in the documentation site.

## 📖 What's Covered

### Feature Guide (~659 lines)

Detailed explanations of all features organized by workflow:

- Getting started
- Problem management (create, import, edit, delete)
- Test case management (manual, files, embedded, CPH import)
- Running and testing
- Result analysis (21 judge statuses explained)
- Advanced features (SPJ, interactive, brute force comparison)
- Integration features (Codeforces submit, Git, AI tools)
- Tips and best practices

### Configuration Reference (~1083 lines)

Complete reference for all 50+ settings across 10 categories:

1. Basic Settings
2. Compilation Settings (C, C++, Java)
3. Runner Settings
4. Comparing Settings
5. Brute Force Compare Settings
6. Problem Settings
7. Cache Settings
8. CPH Compatibility Settings
9. Competitive Companion Settings
10. Sidebar Settings

Each setting includes:
- Type and default value
- Detailed description
- Example JSON configuration
- When to change / use cases

### FAQ (~245 lines)

Answers to 30+ common questions organized by:

- General questions
- Installation & setup
- Using CPH-NG
- Advanced features
- Troubleshooting
- Getting help

## 🔗 Quick Links

- **Install CPH-NG:** [VS Code Marketplace](vscode:extension/langningchen.cph-ng)
- **Source Code:** [GitHub Repository](https://github.com/langningchen/cph-ng)
- **Report Issues:** [GitHub Issues](https://github.com/langningchen/cph-ng/issues)
- **Discussions:** [GitHub Discussions](https://github.com/langningchen/cph-ng/discussions)

## 📊 Documentation Statistics

- **Total Lines:** 4,669+ lines of documentation
- **Languages:** 2 (English, Chinese)
- **Pages:** 7 main documentation pages
- **Images:** 23 screenshots showing actual UI
- **Build Size:** 9.5 MB (static site)

## 🛠️ Building the Documentation

### Prerequisites

```bash
pip install -r requirements.txt
```

### Development Server

```bash
mkdocs serve
```

Visit http://localhost:8000 to preview.

### Production Build

```bash
mkdocs build
```

Output in `site/` directory.

## 📝 Documentation Structure

For detailed information about how the documentation is organized, maintained, and contributed to, see [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md).

## 🎯 Feature Highlights

### Workflow-Based Organization

Documentation follows the natural flow of using CPH-NG:

1. Install → 2. Create Problem → 3. Add Tests → 4. Run → 5. Analyze Results → 6. Advanced Usage

### Comprehensive Cross-References

Every page links to related sections, making it easy to:

- Find configuration options for specific features
- Learn more details about basic concepts
- Troubleshoot issues with relevant guides

### Bilingual Support

Full translations for core content:

- ✅ Overview pages
- ✅ Feature guides (all 20KB+ of content)
- ✅ Configuration references (all 50+ settings)
- ✅ FAQ (30+ Q&As)

### Rich Formatting

Uses MkDocs Material theme with:

- 📋 Admonitions (tips, notes, warnings)
- 💻 Syntax-highlighted code blocks
- 📊 Tables for structured information
- 🎨 Emoji for visual cues
- 🔗 Deep linking with anchors
- 📱 Mobile-responsive design

## 🤝 Contributing to Documentation

We welcome documentation improvements! Here's how to help:

### Fixing Issues

1. Found a typo or error? Edit the markdown file directly
2. Submit a pull request with your fix
3. See [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md) for style guidelines

### Adding Content

1. Check if the content fits existing pages
2. If creating a new page, update `mkdocs.yml` navigation
3. Add both English and Chinese versions
4. Include cross-references to related content
5. Test the build before submitting

### Translating

Chinese translations are maintained separately:

- English: `page.en.md` or `page.md`
- Chinese: `page.zh.md`

When updating English content, please update Chinese translations too, or note that translations need updating in your PR.

## 📞 Getting Help

- **Documentation Issues:** [GitHub Issues](https://github.com/langningchen/cph-ng/issues) with "documentation" label
- **Feature Questions:** Check [FAQ](faq.md) first, then [GitHub Discussions](https://github.com/langningchen/cph-ng/discussions)
- **Usage Help:** See [Feature Guide](features.md) for detailed explanations

## 📜 License

Documentation is part of CPH-NG and licensed under [AGPL-3.0](../LICENSE).

---

**Happy Competitive Programming! 🎉**
