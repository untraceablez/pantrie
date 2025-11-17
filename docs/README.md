# Pantrie Documentation

This directory contains the source files for Pantrie's documentation, built with [MkDocs](https://www.mkdocs.org/) and the [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) theme.

## Quick Start

### View Documentation Locally

To serve the documentation locally for development:

```bash
./serve-docs.sh
```

The documentation will be available at `http://localhost:8001/pantrie-spec/`

### Build Documentation

To build the static documentation site:

```bash
./build-docs.sh
```

The built site will be in the `site/` directory.

## Manual Setup

If you prefer to manage the environment manually:

```bash
# Create virtual environment
python3 -m venv docs-venv

# Install dependencies
docs-venv/bin/pip install -r docs-requirements.txt

# Serve documentation
docs-venv/bin/mkdocs serve

# Or build static site
docs-venv/bin/mkdocs build
```

## Documentation Structure

```
docs/
├── index.md                    # Home page with navigation overview
├── getting-started/            # Installation and quick start guides
├── user-guide/                 # End-user documentation
├── api/                        # API documentation
├── development/                # Developer guides
└── deployment/                 # Deployment guides
    ├── cloudflare-tunnels.md   # Cloudflare Tunnels setup
    └── nginx-proxy-manager.md  # NGINX Proxy Manager setup
```

## Writing Documentation

### Markdown Extensions

The documentation supports enhanced markdown features:

- **Code highlighting** with syntax highlighting
- **Admonitions** (notes, warnings, tips, etc.)
- **Tabbed content** for multiple options
- **Tables** for structured data
- **Emojis** using `:emoji_name:` syntax
- **Task lists** with checkboxes

### Example Admonitions

```markdown
!!! note "Optional Title"
    This is a note admonition.

!!! warning
    This is a warning.

!!! tip
    This is a helpful tip.

!!! danger
    This is a danger warning.
```

### Example Tabs

```markdown
=== "Option 1"
    Content for option 1

=== "Option 2"
    Content for option 2
```

### Example Code Blocks

````markdown
```python
def hello_world():
    print("Hello, World!")
```
````

## Material Theme Features

The documentation uses Material for MkDocs with these features enabled:

- **Dark/Light mode toggle** - User preference is saved
- **Search** - Full-text search with suggestions
- **Navigation tabs** - Top-level navigation
- **Table of Contents** - Right sidebar with page outline
- **Copy to clipboard** - For code blocks
- **Git revision dates** - Shows when pages were last updated

## Contributing

When adding new documentation:

1. Create markdown files in the appropriate directory
2. Update `mkdocs.yml` navigation if adding new top-level pages
3. Use proper markdown formatting and admonitions
4. Test locally with `./serve-docs.sh`
5. Build to verify no errors with `./build-docs.sh`

## Resources

- [MkDocs Documentation](https://www.mkdocs.org/)
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
- [Markdown Guide](https://www.markdownguide.org/)
- [PyMdown Extensions](https://facelessuser.github.io/pymdown-extensions/)
