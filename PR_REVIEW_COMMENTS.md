# PR Review Comments

## Overview
- **Total Files Changed**: 3
- **Total Issues Found**: 13
- **High Priority**: 4
- **Medium Priority**: 6
- **Low Priority**: 3

---

## 📄 README.md

### [ ] Issue 1: Inconsistent date format
**Priority**: Low | **Type**: Documentation

**Location**: Lines 7-12

**Current Code**:
```markdown
*Last updated: Thursday, January 22, 2026*
```

**Reason**: Hardcoded dates become outdated quickly and need manual maintenance. Users may question if the documentation is current.

**Proposed Solution**:
```markdown
*Last updated: 2026-01-22*
```
**OR**
```markdown
*Last updated automatically via CI*
```

---

### [ ] Issue 2: Markdown heading levels inconsistency
**Priority**: Medium | **Type**: Documentation

**Location**: Lines 26-48 (Step 1, Step 2, etc.)

**Current Code**:
```markdown
### Step 1: Prerequisites
Ensure you have Docker installed and running:
- **macOS:** [Install Docker Desktop](https://www.docker.com/products/docker-desktop) and start it

### Step 2: Download and Setup
```bash
git clone https://github.com/kokorolx/ai-sandbox-wrapper.git
```

**Reason**: Inconsistent heading hierarchy makes the document harder to navigate and renders poorly with some markdown viewers.

**Proposed Solution**:
```markdown
## 🚀 Installation

### Prerequisites
Ensure you have Docker installed and running:
- **macOS:** [Install Docker Desktop](https://www.docker.com/products/docker-desktop) and start it

### Step 1: Download and Setup
### Step 2: Follow the Interactive Prompts
### Step 3: Complete Setup
### Step 4: Verify Installation
### Step 5: Run Your First Tool
```

---

### [ ] Issue 3: Duplicate information in "Quick Reference" section
**Priority**: Medium | **Type**: Documentation

**Location**: Lines 448-485

**Current Code**:
```markdown
## 📚 Quick Reference

### Main Commands
- `ai-run <tool>` - Run any tool in sandbox (e.g., `ai-run gemini`)
- `<tool>` - Shortcut for tools you installed (e.g., `gemini`, `aider`)

### Configuration Files
- `~/.ai-env` - Store API keys here
- `~/.ai-workspaces` - Whitelisted project directories
- `~/.ai-cache/` - Tool cache (persistent)
- `~/.ai-home/` - Tool configurations (persistent)
```

**Reason**: Duplicate content increases maintenance burden - changes need to be made in multiple places. The same information appears in the "Configuration" section (lines 112-148).

**Proposed Solution**:
Option A - Remove the section entirely
Option B - Make it a brief table of contents:
```markdown
## 📚 Quick Reference

| Section | What You'll Find |
|---------|-----------------|
| [Installation](#-installation) | Step-by-step setup guide |
| [Configuration](#️-configuration) | API keys, workspaces, image source |
| [Directory Structure](#-directory-structure) | File locations and purposes |
| [Troubleshooting](#-troubleshooting) | Common issues and fixes |
```

---

### [ ] Issue 4: Broken/unclear registry URLs
**Priority**: High | **Type**: Functionality

**Location**: Lines 46, 48

**Current Code**:
```markdown
docker pull registry.gitlab.com/kokorolee/ai-sandbox-wrapper/ai-gemini:latest
```

**Reason**:
1. URL references `kokorolee` but GitHub repo uses `kokorolx` (line 27)
2. No verification these images exist in the registry
3. Users will encounter errors if they don't exist

**Proposed Solution**:
```markdown
docker pull registry.gitlab.com/kokorolx/ai-sandbox-wrapper/ai-gemini:latest
docker pull registry.gitlab.com/kokorolx/ai-sandbox-wrapper/ai-aider:latest
```

**Also add**:
```markdown
**Note**: If the pull fails, the images may not be available yet. You can build locally by running:
```bash
./setup.sh  # Select "local" for image source
```
```

---

### [ ] Issue 5: Missing context for API key examples
**Priority**: Medium | **Type**: Usability

**Location**: Lines 126-133, 308-317

**Current Code**:
```bash
# Add your API keys (only if using tools that require them)
nano ~/.ai-env  # Add GOOGLE_API_KEY, OPENAI_API_KEY, etc.
```

**Reason**: Users may not know which keys are required for which tools. The "Optional" comment is confusing.

**Proposed Solution**:
Add a clear table after the installation section:
```markdown
### API Key Requirements

| Tool | API Key Required | Environment Variable | Where to Get It |
|------|-----------------|---------------------|----------------|
| Gemini | ✅ Yes | GOOGLE_API_KEY | https://aistudio.google.com/ |
| Aider | ⚠️ Optional | OPENAI_API_KEY | https://platform.openai.com/ |
| Kilo | ⚠️ Optional | OPENAI_API_KEY | https://platform.openai.com/ |
| Codex | ⚠️ Optional | OPENAI_API_KEY | https://platform.openai.com/ |

**Note**: Add your keys to `~/.ai-env`:
```bash
$EDITOR ~/.ai-env
```

Example content:
```
GOOGLE_API_KEY=AIza...
OPENAI_API_KEY=sk-...
```
```

---

### [ ] Issue 6: Hardcoded `nano` editor command
**Priority**: Low | **Type**: Cross-platform

**Location**: Lines 52, 114, 281, 317, 462

**Current Code**:
```bash
nano ~/.ai-env
nano ~/.ai-workspaces
```

**Reason**: The README consistently uses `nano` for file editing, which:
- Assumes `nano` is installed (not on all systems)
- Creates inconsistent user experience

**Proposed Solution**:
Replace with editor-agnostic approach:
```bash
# Edit environment file (use your preferred editor: nano, vim, code, etc.)
$EDITOR ~/.ai-env

# Or explicitly:
nano ~/.ai-env  # macOS
vim ~/.ai-env   # Linux
code ~/.ai-env  # VS Code
```

---

### [ ] Issue 7: Missing code block language specifiers
**Priority**: Low | **Type**: Documentation

**Location**: Lines throughout the file

**Current Code**:
Some code blocks have language specifiers, others don't:
```
git clone https://github.com/kokorolx/ai-sandbox-wrapper.git
```
vs
```bash
docker pull registry.gitlab.com/kokorolee/ai-sandbox-wrapper/ai-gemini:latest
```

**Reason**: Without language specifiers, syntax highlighting doesn't work, making code harder to read.

**Proposed Solution**: Ensure all code blocks have appropriate language specifiers:
```markdown
```bash   # For shell commands
```python  # For Python code
```json   # For JSON configuration
```sh     # For shell scripts
```

---

### [ ] Issue 8: Redundant directory structure section
**Priority**: Medium | **Type**: Documentation

**Location**: Lines 200-230

**Current Code**: Separate table and tree diagrams for directory structure

**Reason**: Overlapping information makes the section verbose and harder to scan.

**Proposed Solution**: Consolidate into a single tree diagram with inline comments:
```markdown
## 📁 Directory Structure

AI Sandbox Wrapper creates and manages the following directories:

```
~/
├── bin/                    # Executables: ai-run, tool symlinks
├── .ai-env                 # API keys (format: KEY=VALUE, one per line)
├── .ai-workspaces          # Whitelisted directories (one per line)
├── .ai-git-allowed         # Workspaces with Git access enabled
├── .ai-git-keys-*         # Saved SSH key selections (md5-hashed)
├── .ai-cache/              # Tool cache directories
│   ├── gemini/             # Gemini CLI cache
│   ├── aider/              # Aider cache
│   └── git/ssh/            # Git credentials (when enabled)
└── .ai-home/               # Tool home directories with persistent configs
    ├── gemini/             # Gemini configuration
    ├── aider/              # Aider config and history
    └── .gitconfig          # Git configuration (when Git access enabled)
```
```

---

## 🐳 dockerfiles/base/Dockerfile

### [ ] Issue 9: Pipe-to-shell security concern
**Priority**: High | **Type**: Security

**Location**: Line 17

**Current Code**:
```dockerfile
&& curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
```

**Reason**: Piping a curl command directly to shell (`curl ... | sh`) is a security anti-pattern. If the download URL is compromised or the script changes maliciously, users will execute arbitrary code without review.

**Proposed Solution**:
```dockerfile
# Download, verify, then execute
RUN curl -LsSf https://astral.sh/uv/install.sh -o /tmp/uv-install.sh \
    && chmod +x /tmp/uv-install.sh \
    && UV_INSTALL_DIR=/usr/local/bin /tmp/uv-install.sh \
    && rm -f /tmp/uv-install.sh
```

**Even better with version pinning (see Issue 10)**:
```dockerfile
RUN curl -LsSf https://github.com/astral-sh/uv/releases/download/0.1.23/uv-installer.sh \
    -o /tmp/uv-install.sh \
    && chmod +x /tmp/uv-install.sh \
    && UV_INSTALL_DIR=/usr/local/bin /tmp/uv-install.sh \
    && rm -f /tmp/uv-install.sh
```

---

### [ ] Issue 10: Unpinned `uv` version
**Priority**: High | **Type**: Reproducibility

**Location**: Line 17

**Current Code**:
```dockerfile
&& curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
```

**Reason**: Reproducible builds require pinned versions. Using "latest" can break builds if a new version has breaking changes.

**Proposed Solution** (Option A - Script with version):
```dockerfile
RUN curl -LsSf https://astral.sh/uv/0.1.23/install.sh | \
    UV_INSTALL_DIR=/usr/local/bin sh
```

**Proposed Solution** (Option B - Binary download - more reproducible):
```dockerfile
# Download specific version directly (more reproducible)
RUN curl -LsSf https://github.com/astral-sh/uv/releases/download/0.1.23/uv-x86_64-unknown-linux-gnu.tar.gz \
    -o /tmp/uv.tar.gz \
    && tar xzf /tmp/uv.tar.gz -C /tmp \
    && mv /tmp/uv-x86_64-unknown-linux-gnu/uv /usr/local/bin/uv \
    && chmod +x /usr/local/bin/uv \
    && rm -rf /tmp/uv* \
    && uv --version
```

**Recommendation**: Use Option B for maximum reproducibility.

---

### [ ] Issue 11: Missing error handling
**Priority**: Medium | **Type**: Robustness

**Location**: Line 17

**Current Code**:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ... \
    && rm -rf /var/lib/apt/lists/* \
    && pipx ensurepath
```

**Reason**: If `curl` fails or the install script fails, the Docker build may continue with partial installation, leading to inconsistent image state.

**Proposed Solution**:
```dockerfile
RUN set -euxo pipefail && \
    apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ssh \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-setuptools \
    build-essential \
    libopenblas-dev \
    pipx \
    # Install uv with proper error handling
    && curl -LsSf https://github.com/astral-sh/uv/releases/download/0.1.23/uv-x86_64-unknown-linux-gnu.tar.gz \
    -o /tmp/uv.tar.gz \
    && [ -s /tmp/uv.tar.gz ] || (echo "Failed to download uv" && exit 1) \
    && tar xzf /tmp/uv.tar.gz -C /tmp \
    && mv /tmp/uv-x86_64-unknown-linux-gnu/uv /usr/local/bin/uv \
    && chmod +x /usr/local/bin/uv \
    && uv --version || (echo "uv installation failed" && exit 1) \
    && rm -rf /tmp/uv* \
    && rm -rf /var/lib/apt/lists/* \
    && pipx ensurepath
```

---

## 📜 lib/install-base.sh

### [ ] Issue 12: Code duplication (DRY violation)
**Priority**: Medium | **Type**: Maintainability

**Location**: Lines 22-24 (identical to Dockerfile lines 16-17)

**Current Code**:
```bash
    && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
```
(Duplicated in both `dockerfiles/base/Dockerfile` and `lib/install-base.sh`)

**Reason**: Violates DRY (Don't Repeat Yourself) principle. If the installation needs to change, it must be updated in two places, increasing risk of inconsistencies.

**Proposed Solution** (Option A - Extract to shared script):
Create new file `lib/install-uv.sh`:
```bash
#!/usr/bin/env bash
# UV installation script
# Usage: UV_VERSION=<version> UV_INSTALL_DIR=<path> bash lib/install-uv.sh

set -euo pipefail

UV_VERSION="${UV_VERSION:-0.1.23}"
UV_INSTALL_DIR="${UV_INSTALL_DIR:-/usr/local/bin}"
ARCH="x86_64-unknown-linux-gnu"

echo "Installing uv ${UV_VERSION} to ${UV_INSTALL_DIR}..."

curl -LsSf "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-${ARCH}.tar.gz" \
    -o /tmp/uv.tar.gz \
    && [ -s /tmp/uv.tar.gz ] || (echo "Failed to download uv" && exit 1) \
    && tar xzf /tmp/uv.tar.gz -C /tmp \
    && mv /tmp/uv-${ARCH}/uv "${UV_INSTALL_DIR}/uv" \
    && chmod +x "${UV_INSTALL_DIR}/uv" \
    && uv --version || (echo "uv installation failed" && exit 1) \
    && rm -rf /tmp/uv*

echo "✅ uv ${UV_VERSION} installed successfully"
```

Then in both files:
```dockerfile
# In dockerfiles/base/Dockerfile
COPY lib/install-uv.sh /tmp/install-uv.sh
RUN bash /tmp/install-uv.sh && rm /tmp/install-uv.sh
```

```bash
# In lib/install-base.sh
bash lib/install-uv.sh
```

**Proposed Solution** (Option B - Document the duplication):
```bash
# Note: Keep this in sync with dockerfiles/base/Dockerfile
# When updating, update both files to maintain consistency
# Shared via: TODO: Consider extracting to lib/install-uv.sh
&& curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
```

**Recommendation**: Option A for long-term maintainability.

---

### [ ] Issue 13: Same security and versioning issues as Dockerfile
**Priority**: High | **Type**: Security

**Location**: Lines 22-24

**Current Code**:
```bash
    && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
```

**Reason**: All the same issues from Dockerfile apply here:
- Pipe-to-shell security risk (Issue 9)
- Unpinned version (Issue 10)
- Missing error handling (Issue 11)

**Proposed Solution**: Apply the same fixes as Issues 9, 10, 11 from the Dockerfile review, or use the shared script approach from Issue 12.

---

## 📋 Approval Checklist

Use this checklist to approve each comment:

### High Priority (4 items)
- [ ] Issue 4: Fix registry URLs in README.md
- [ ] Issue 9: Fix pipe-to-shell in Dockerfile
- [ ] Issue 10: Pin uv version in Dockerfile
- [ ] Issue 13: Fix security issues in lib/install-base.sh

### Medium Priority (6 items)
- [ ] Issue 2: Fix heading hierarchy in README.md
- [ ] Issue 3: Remove duplicate Quick Reference in README.md
- [ ] Issue 5: Add API key requirements table in README.md
- [ ] Issue 8: Consolidate directory structure in README.md
- [ ] Issue 11: Add error handling in Dockerfile
- [ ] Issue 12: Fix code duplication (or document it)

### Low Priority (3 items)
- [ ] Issue 1: Update date format in README.md
- [ ] Issue 6: Remove hardcoded nano in README.md
- [ ] Issue 7: Add language specifiers in README.md

---

## 🎯 Recommended Action Priority

1. **Fix First (Security & Breaking Changes)**:
   - Issue 4, 9, 10, 13 (Security and reproducibility)

2. **Fix Second (Maintainability & UX)**:
   - Issue 12 (DRY violation)
   - Issue 5 (Missing API key context)
   - Issue 2, 3, 8 (Documentation organization)

3. **Fix Later (Nice to Have)**:
   - Issue 1, 6, 7 (Minor documentation improvements)
   - Issue 11 (Error handling - though recommended)

---

## 📝 Notes

- All line numbers are approximate and based on the diff output
- Proposed solutions can be mixed and matched
- Consider creating a separate tracking issue for the low-priority items
- The uv installation improvements should be coordinated across all affected files
