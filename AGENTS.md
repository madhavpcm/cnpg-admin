# CNPG Admin - Agent Guidelines

## Project Overview
- **Project Name**: CNPG Admin
- **Type**: Kubernetes Operator UI / Web Application
- **Core Functionality**: MongoDB Atlas-like UI for managing CloudNativePG clusters via k8s operator API
- **Target Users**: DBAs and SREs working in on-prem/airgapped environments

## Technical Constraints
- Must run as a pod in `cnpg-system` namespace
- Must work in airgapped/offline environments (no external CDNs)
- Low vulnerability attack surface
- Single binary deployment preferred

## Architecture

### Backend (Go)
- RESTful API server
- Talks to k8s API server using client-go
- Communicates with CNPG operator via CRDs
- Embedded static frontend assets

### Frontend
- Go WebAssembly (WASM) compiled from Go
- Tiny JS loader to bootstrap WASM (~1KB)
- Zero external JS dependencies
- Can share Go code between backend and frontend
- Kubernetes-native authentication (service account)

### GitOps Integration
- Cluster configurations stored in Git repositories
- Support for Helm values file approach
- Standardized multi-cluster configuration format
- File format: YAML with map-based cluster definitions

## Key Features

### Core Features
1. **Cluster Management**
   - Create new CNPG clusters with UI
   - View cluster status and health
   - Scale clusters (replicas)
   - Delete clusters

2. **User/Role Management**
   - Create database users
   - Manage roles and permissions
   - Password management

3. **Query Executor**
   - SQL query editor
   - Execute queries against clusters
   - Query results table view

4. **Table Preview**
   - Browse database tables
   - View schema information
   - Row preview

### Advanced Features
5. **Observability Metrics**
   - Connection metrics
   - Query performance
   - Storage usage

6. **Query Analytics**
   - Slow query log
   - Query statistics

7. **Logs**
   - Pod logs
   - PostgreSQL logs

8. **GitOps**
   - Connect cluster config to Git repo
   - Sync configurations
   - GitOps-driven deployments

## GitOps Design

### Configuration File Structure
```yaml
# cnpg-clusters.yaml in Git repo
clusters:
  prod-cluster-1:
    namespace: production
    version: "16"
    instances: 3
    storage: 10Gi
    # ... CNPG spec overrides
  staging-cluster-2:
    namespace: staging
    # ...
```

### GitOps Flow
1. User connects Git repository (HTTPS with credentials or SSH)
2. System watches for changes in configured file(s)
3. On change: reconcile cluster state with Git
4. Support for branch selection
5. Manual or automatic sync modes

## Development Guidelines

### Code Style
- Follow Go standard conventions
- Use `gofmt` and `goimports`
- Meaningful variable names

### Security
- No hardcoded credentials
- Use k8s service account for auth
- RBAC-aware operations

### Code Exploration
- **ALWAYS use GitNexus for code lookups** — use `gitnexus_query`, `gitnexus_context`, and related tools instead of grep/glob to find code by concept and understand execution flows.

### Dependencies
- Minimal external dependencies
- Prefer standard library when possible
- Audit dependencies for vulnerabilities

## Development Setup

### Using Nix Flake (Recommended)

This project uses Nix flakes for reproducible builds.

```bash
# Enter development shell
nix develop

# Build backend server
nix build .#packages.x86_64-linux.cnpg-admin

# Build WASM frontend
nix build .#packages.x86_64-linux.wasm

# Or run directly
nix run .#packages.x86_64-linux.cnpg-admin
```

### Manual Setup

```bash
# Install Go 1.23+
# Build server
go build -o cnpg-admin ./cmd/server

# Build WASM frontend
GOOS=js GOARCH=wasm go build -o web/static/wasm/app.wasm ./cmd/wasm
```

### WASM Loader

The Go standard library includes `wasm_exec.js`. Copy it from:
```bash
$(go env GOROOT)/misc/wasm/wasm_exec.js
```
to `web/static/wasm.js` before building the WASM.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cnpg-admin** (181 symbols, 250 relationships, 3 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/cnpg-admin/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cnpg-admin/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cnpg-admin/clusters` | All functional areas |
| `gitnexus://repo/cnpg-admin/processes` | All execution flows |
| `gitnexus://repo/cnpg-admin/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
