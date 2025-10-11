# CPH-NG Documentation Structure

This document describes the structure and organization of the CPH-NG documentation.

## Overview

The documentation is built using MkDocs with the Material theme, supporting both English and Chinese (Simplified) versions.

## Documentation Pages

### 1. Overview (index.en.md / index.zh.md)

**Purpose:** Landing page introducing CPH-NG

**Content:**
- Project introduction
- Key features overview
- Quick links to other documentation sections
- Installation instructions

**Target Audience:** New users discovering CPH-NG

### 2. Quick Start (quickStart.md)

**Purpose:** Get users started quickly

**Content:**
- Installation instructions
- Creating first problem
- Adding test cases
- Running tests
- Next steps with links to detailed guides

**Target Audience:** New users ready to start using CPH-NG

### 3. Features (features/ folder with 21 pages)

**Purpose:** Individual detailed documentation for each feature

**Structure:**
Each feature has its own page following unified format:

- **Overview** - Purpose and functionality
- **UI Interaction** - Triggering methods, prerequisites, UI components
- **Internal Operation** - Code flow with source file:line references
- **Configuration Options** - Related settings that affect behavior
- **Error Handling** - Common errors and solutions
- **Workflow Examples** - Practical usage scenarios
- **Related Features** - Links to connected functionality
- **Technical Details** - Dependencies, data structures, source references

**Organization:**
- `features/index.md` - Navigation hub
- **Problem Management/** - Create, Import, Edit, Delete
- **Test Case Management/** - Add, Load, Edit, Delete, Toggle, Compare
- **Running and Testing/** - Run Single, Run All, Stop, Clear
- **Advanced Features/** - Brute Force, SPJ, Interactive, Submit
- **Integration/** - Competitive Companion, CPH Import

**Target Audience:** Users needing detailed feature understanding with code references

### 4. Configuration (configuration/ folder)

**Purpose:** Settings reference organized by category

**Structure:**
- `configuration/index.md` - Overview and navigation
  - Lists all 10 setting categories
  - Path variables reference table
  - Configuration examples (competitive, debug, performance)
  - Source code references

**Planned Individual Pages** (to be created):
- `basic.md` - Basic extension settings
- `compilation.md` - Compiler configuration
- `runner.md` - Execution settings
- `comparing.md` - Output comparison
- `brute-force.md` - BF compare settings
- `problem.md` - Problem defaults and paths
- `cache.md` - Cache management
- `cph-compat.md` - CPH compatibility
- `companion.md` - Browser extension integration
- `sidebar.md` - UI customization

**Target Audience:** Users customizing CPH-NG behavior

### 5. Modules (modules.md)

**Purpose:** Additional features and workflows

**Content:**
- Compare with answer
- Data display toggles
- Load samples from files/folders
- Edit problem metadata
- Elapsed time tracking
- Delete problem
- Load from embedded data
- Import from CPH
- Special Judge

**Target Audience:** Users exploring specific functionality

### 6. FAQ (faq.md / faq.zh.md)

**Purpose:** Answer common questions

**Content organized by category:**
- General Questions
- Installation & Setup
- Using CPH-NG
- Advanced Features
- Troubleshooting
- Getting Help
- Additional Resources

**Target Audience:** Users with specific questions or issues

### 7. About (about.md)

**Purpose:** Project information and contribution guidelines

**Content:**
- About the project
- Contributing guidelines
- License information

**Target Audience:** Contributors and users wanting to learn more about the project

## Navigation Structure

The documentation uses a tab-based navigation in this order:

1. Overview
2. Quick Start
3. Feature Guide
4. Configuration
5. Modules
6. FAQ
7. About

This order follows a typical user journey from discovery to advanced usage.

## Cross-Referencing Strategy

Documentation pages are extensively cross-referenced:

- **Overview** → Quick Start, Feature Guide, Configuration, FAQ
- **Quick Start** → Feature Guide, Configuration
- **Feature Guide** → Configuration (specific settings for each feature)
- **Modules** → Feature Guide (detailed explanations), Configuration
- **FAQ** → All other pages as needed

## Markdown Extensions

The documentation uses these MkDocs Material extensions:

- **Admonitions** (`!!!` syntax) for tips, notes, warnings
- **Code highlighting** with copy buttons
- **Tables** for structured information
- **Emoji** for visual enhancement
- **Tabbed content** for alternative options
- **Table of contents** with deep linking

## Image Organization

All images are stored in `docs/images/` and referenced relatively:

```markdown
![Description](images/imagename.png)
```

Images show actual UI elements and workflows to help users understand features visually.

## Localization

### Supported Languages

- **English** (default): `*.en.md` or `*.md` (without suffix)
- **Chinese (Simplified)**: `*.zh.md`

### Translation Status

As of this documentation:

- ✅ **Fully translated:**
  - Overview (index)
  - Feature Guide
  - Configuration Reference
  - FAQ

- ⚠️ **Partially translated:**
  - Quick Start (uses shared English version)
  - Modules (uses shared English version)
  - About (uses shared English version)

### Translation Guidelines

When translating:

1. Maintain the same structure and headings
2. Translate content while preserving technical terms appropriately
3. Update cross-references to point to corresponding translated pages
4. Keep code examples and configuration samples in English
5. Translate UI element names consistently

## Building the Documentation

### Development Server

```bash
mkdocs serve
```

Visit http://localhost:8000 to preview changes in real-time.

### Production Build

```bash
mkdocs build
```

Generates static site in `site/` directory.

### Strict Mode (for CI)

```bash
mkdocs build --strict
```

Treats warnings as errors.

## Contributing to Documentation

### Adding a New Page

1. Create the markdown file in `docs/`
2. Create translated versions (e.g., `page.en.md`, `page.zh.md`)
3. Add to `nav` section in `mkdocs.yml`
4. Add cross-references from related pages
5. Test the build locally

### Updating Existing Content

1. Make changes to the markdown file
2. Update translated versions
3. Update cross-references if structure changed
4. Verify all links still work
5. Test the build

### Style Guidelines

1. **Headings:** Use sentence case, not title case
2. **Code blocks:** Always specify language for syntax highlighting
3. **Links:** Use relative paths, not absolute URLs for internal pages
4. **Admonitions:** Use appropriate types (tip, note, warning, info)
5. **Images:** Include descriptive alt text
6. **Lists:** Use `-` for unordered lists, numbers for ordered

### Writing Style

1. **Be concise:** Get to the point quickly
2. **Be specific:** Include exact steps, not vague instructions
3. **Be helpful:** Explain why, not just what
4. **Use examples:** Show concrete usage
5. **Think workflow:** Organize by how users work, not by code structure

## Maintenance

### Regular Tasks

- Update screenshots when UI changes
- Add new features to Feature Guide and Configuration Reference
- Update FAQ with common questions from issues
- Verify all links after refactoring
- Keep translations synchronized

### Quality Checks

Before committing documentation changes:

1. ✅ Run `mkdocs build` to verify it builds
2. ✅ Check for broken internal links
3. ✅ Verify images display correctly
4. ✅ Test cross-references
5. ✅ Review in both English and Chinese
6. ✅ Check mobile responsiveness (Material theme handles this)

## Future Improvements

Potential enhancements:

- [ ] Add video tutorials
- [ ] Create interactive examples
- [ ] Add search optimization
- [ ] Expand language support (Japanese, Korean, etc.)
- [ ] Add version-specific documentation
- [ ] Create PDF export option
- [ ] Add contribution statistics
- [ ] Create API documentation if extension provides public APIs

## Resources

- **MkDocs:** https://www.mkdocs.org/
- **Material Theme:** https://squidfunk.github.io/mkdocs-material/
- **MkDocs Static i18n:** https://github.com/ultrabug/mkdocs-static-i18n
- **Markdown Guide:** https://www.markdownguide.org/

## Questions?

For questions about the documentation:

- Open an issue: https://github.com/langningchen/cph-ng/issues
- Start a discussion: https://github.com/langningchen/cph-ng/discussions
