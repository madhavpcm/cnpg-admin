# CNPG Admin - Design Document

## 1. Overview

CNPG Admin is a Kubernetes-native web UI for managing CloudNativePG clusters, designed for on-prem/airgapped environments. It provides a MongoDB Atlas-like experience for DBAs and SREs to manage PostgreSQL clusters via the CNPG operator.

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CNPG Admin Pod                         │
│  ┌─────────────────────┐    ┌────────────────────────────────┐ │
│  │   Go HTTP Server    │    │    Embedded Static Assets     │ │
│  │   - REST API        │◄───│    - HTML/CSS/JS              │ │
│  │   - Auth Middleware │    │    - No external dependencies  │ │
│  └─────────┬───────────┘    └────────────────────────────────┘ │
│            │                                                    │
│  ┌─────────▼───────────┐                                        │
│  │   Kubernetes Client │◄───► Kubernetes API Server            │
│  │   (client-go)       │      - CNPG CRDs                      │
│  └─────────────────────┘      - Namespaces                    │
│                                - Secrets                        │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CNPG Operator                                │
│  ┌─────────────────┐    ┌─────────────────────────────────┐   │
│  │ CNPG Controller │───►│ Postgres Clusters (CRD)         │   │
│  └─────────────────┘    └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Tech Stack

### Backend
- **Language**: Go 1.21+
- **K8s Client**: client-go
- **Web Framework**: Chi (lightweight, middleware-based)
- **Templating**: Go html/template (for server-rendered pages if needed)
- **YAML Parsing**: go-yaml/yaml

### Frontend
- **Go WebAssembly (WASM)**: Compiled Go running in browser
- **Tiny JS Loader**: ~1KB to bootstrap WASM
- **No external JS dependencies**: Everything runs in WASM
- **Code Sharing**: Can share Go code between backend and frontend

*Note: WASM provides excellent security isolation and zero JS attack surface*

### Build
- **Single Binary**: CGO_ENABLED=0, embed static assets
- **Container**: Distroless or scratch base image

## 4. API Design

### Clusters
```
GET    /api/clusters                    # List all clusters
POST   /api/clusters                    # Create cluster
GET    /api/clusters/:name              # Get cluster details
PUT    /api/clusters/:name              # Update cluster
DELETE /api/clusters/:name              # Delete cluster
POST   /api/clusters/:name/scale        # Scale replicas
```

### Users
```
GET    /api/clusters/:name/users        # List database users
POST   /api/clusters/:name/users        # Create user
DELETE /api/clusters/:name/users/:user  # Delete user
```

### Query Executor
```
POST   /api/clusters/:name/query        # Execute SQL query
GET    /api/clusters/:name/tables       # List tables
GET    /api/clusters/:name/tables/:table # Table schema
```

### Metrics & Logs
```
GET    /api/clusters/:name/metrics       # Observability metrics
GET    /api/clusters/:name/logs          # Pod/database logs
GET    /api/clusters/:name/queries       # Query analytics
```

### GitOps
```
GET    /api/gitops/repos                 # List connected repos
POST   /api/gitops/repos                 # Connect repo
GET    /api/gitops/repos/:id/clusters    # Get clusters from repo
POST   /api/gitops/repos/:id/sync        # Sync cluster state
```

## 5. GitOps Design

### Configuration File Standardization

The GitOps approach uses a standardized YAML file in the connected repository:

```yaml
# cnpg-clusters.yaml
# Root key is a map (not array) for easy lookup by cluster name
clusters:
  prod-cluster-1:
    # Core settings
    namespace: production
    version: "16"
    instances: 3
    storage: 10Gi
    storageClass: fast-ssd
    
    # Pool settings
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "256Mi"
        cpu: "500m"
    
    # Backup settings
    backup:
      enabled: true
      schedule: "0 0 * * *"
      retention: 7
    
    # Monitoring
    monitoring:
      enabled: true
      podMonitor: true
    
    # Custom CNPG spec overrides (merged)
    # spec:
    #   ...

  staging-cluster-2:
    namespace: staging
    version: "16"
    instances: 2
    storage: 5Gi
    # ...

  dev-cluster:
    namespace: dev
    version: "16"
    instances: 1
    storage: 1Gi
```

### GitOps Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Git Repo    │────►│  CNPG Admin  │────►│  K8s API    │
│  (values.yaml)    │  Controller  │     │  Server     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    
       │ File Change        │ Parse & Validate  
       │ (webhook/manual)   │                    
       │                    ▼                    
       │             ┌──────────────┐
       │             │ Reconcile    │
       │             │ (diff & apply)│
       │             └──────────────┘
       │                    │
       └────────────────────┘
            Sync Status
```

### Repository Connection
- **HTTPS**: Username/password or token authentication
- **SSH**: Private key authentication (stored in K8s secrets)
- **Branch Selection**: Support for main, release branches
- **File Path**: Configurable path to cnpg-clusters.yaml
- **Sync Modes**: Manual trigger or automatic via webhook

## 6. Security

### Authentication
- Kubernetes Service Account (in-cluster)
- RBAC-based authorization
- No external auth providers

### Secrets Management
- Database passwords stored as K8s secrets
- Git credentials stored as K8s secrets
- No plaintext secrets in code

### Network
- Runs in cnpg-system namespace
- ServiceAccount token mounted at /var/run/secrets/kubernetes.io/serviceaccount/
- TLS recommended for external access

## 7. UI/UX Design

### Visual Style
- Dark theme (like MongoDB Atlas)
- Clean, minimal interface
- Status indicators (green/yellow/red)
- Responsive design

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo | Cluster Selector | User | Settings    │
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│  Nav   │              Main Content Area                │
│        │                                                │
│ Clusters│  ┌────────────────────────────────────────┐  │
│ Users  │  │                                        │  │
│ Query  │  │        Dashboard / Tables / Forms      │  │
│ Tables │  │                                        │  │
│ Metrics│  └────────────────────────────────────────┘  │
│ Logs   │                                                │
│ GitOps │                                                │
│        │                                                │
└────────┴────────────────────────────────────────────────┘
```

## 8. Project Structure

```
cnpg-admin/
├── cmd/
│   ├── server/           # Main HTTP server
│   │   └── main.go
│   └── wasm/             # WASM frontend build
│       └── main.go
├── internal/
│   ├── config/
│   ├── handler/
│   ├── k8s/
│   ├── middleware/
│   ├── gitops/
│   └── ui/               # Shared UI code (used by both server & wasm)
├── web/
│   ├── static/
│   │   ├── index.html    # Minimal HTML + WASM loader (~1KB)
│   │   ├── css/          # CSS styles
│   │   └── wasm/         # Compiled WASM binary
├── pkg/
├── go.mod
├── go.sum
└── Dockerfile
```

## 8b. WASM Build

Build frontend:
```bash
GOOS=js GOARCH=wasm go build -o web/static/wasm/app.wasm ./cmd/wasm
```

Frontend loader (embedded in index.html):
```html
<script>
  WebAssembly.instantiateStreaming(fetch('wasm/app.wasm'), { go: Go })
    .then(result => result.instance.run());
</script>
```

## 9. Deployment

### Kubernetes Manifest
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cnpg-admin
  namespace: cnpg-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cnpg-admin
rules:
  - apiGroups: ["postgresql.cnpg.io"]
    resources: ["clusters"]
    verbs: ["*"]
  - apiGroups: [""]
    resources: ["secrets", "pods"]
    verbs: ["*"]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cnpg-admin
  namespace: cnpg-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cnpg-admin
  template:
    spec:
      serviceAccountName: cnpg-admin
      containers:
      - name: cnpg-admin
        image: cnpg-admin:latest
        ports:
        - containerPort: 8080
```
