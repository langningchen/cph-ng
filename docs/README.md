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

### Features (21 Individual Pages)

Each feature has a dedicated page with:

**Problem Management** (4 pages):
- Create Problem - Initialize new competitive programming problem
- Import Problem - Import from CPH format
- Edit Problem - Modify metadata, limits, SPJ, interactor
- Delete Problem - Remove problem from workspace

**Test Case Management** (6 pages):
- Add Test Case - Manual single case creation
- Load Test Cases - Bulk import from files/folders
- Edit Test Case - Modify input and answer data
- Delete Test Case - Remove specific test case
- Toggle File/Inline - Switch data storage mode
- Compare Output - Visual diff of actual vs expected

**Running and Testing** (4 pages):
- Run Single Test - Execute one test case
- Run All Tests - Execute all sequentially
- Stop Execution - Terminate running tests
- Clear Results - Reset execution results

**Advanced Features** (4 pages):
- Brute Force Compare - Find edge cases automatically
- Special Judge - Custom checker programs  
- Interactive Problems - Support for interactive problems
- Submit to Codeforces - Direct submission

**Integration** (2 pages):
- Competitive Companion - Browser extension integration
- CPH Import - Import from original CPH

Each page includes: UI interaction methods, internal operation with source code references, configuration options, error handling, workflow examples.

### Configuration Reference (10 Categories)

Comprehensive settings documentation organized by category:

1. **Basic Settings** - UI and folder selection
2. **Compilation Settings** - Compilers for C/C++/Java
3. **Runner Settings** - Execution and resource measurement
4. **Comparing Settings** - Output comparison behavior
5. **Brute Force Settings** - Generator and brute force timeouts
6. **Problem Settings** - Defaults and file paths
7. **Cache Settings** - Compilation cache management
8. **CPH Compatibility** - Original CPH integration
9. **Companion Settings** - Browser extension config
10. **Sidebar Settings** - UI customization

Includes: Path variable reference, configuration examples, source code references

### FAQ

Comprehensive Q&A covering:
- General questions and installation
- Feature usage and configuration
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
