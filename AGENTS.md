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
