# CNPG Admin GitOps Integration - Design Document

## Overview

Add lightweight GitOps capabilities to cnpg-admin, enabling bidirectional sync between the UI and a Git repository. Each CNPG cluster configuration is stored as a YAML file following the hierarchy:

```
<repo-root>/<k8s-cluster>/<namespace>/<cluster-name>.yaml
```

**Design Principles:**
- Git as source of truth (optional: UI can override)
- Minimal dependencies (no ArgoCD/Flux required)
- Agent-implementable phases (clear boundaries, testable units)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         cnpg-admin                              │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Clusters │  │ Create   │  │ Edit     │  │ GitOps       │    │
│  │ List     │  │ Cluster  │  │ Cluster  │  │ Settings     │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       │             │             │               │             │
├───────┴─────────────┴─────────────┴───────────────┴─────────────┤
│  API Layer                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ /api/clusters   │  │ /api/gitops     │  │ /api/sync       │  │
│  │ (existing)      │  │ (new)           │  │ (new)           │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
├───────────┴────────────────────┴────────────────────┴───────────┤
│  Service Layer                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ K8s Service     │  │ Git Service     │  │ Sync Service    │  │
│  │ (existing)      │  │ (new)           │  │ (new)           │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Kubernetes API  │  │ GitHub/GitLab   │  │ State Store     │  │
│  │                 │  │ API             │  │ (ConfigMap)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### GitOps Configuration (stored in ConfigMap)

```typescript
// lib/types/gitops.ts

interface GitOpsConfig {
  enabled: boolean;
  repository: {
    url: string;           // https://github.com/org/cnpg-configs
    branch: string;        // main
    path: string;          // clusters/ (prefix path in repo)
  };
  auth: {
    type: 'token' | 'ssh' | 'app';
    secretRef: string;     // k8s secret name containing credentials
  };
  sync: {
    mode: 'push' | 'pull' | 'bidirectional';
    interval: number;      // seconds, 0 = manual only
    autoCommit: boolean;   // auto-commit UI changes
    commitMessage: string; // template: "Update {{cluster}} in {{namespace}}"
  };
  k8sClusterName: string;  // identifier for this k8s cluster
}
```

### Cluster YAML Schema (stored in Git)

```yaml
# <k8s-cluster>/<namespace>/<cluster-name>.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: my-cluster
  namespace: production
  labels:
    managed-by: cnpg-admin
    gitops-sync: "true"
spec:
  instances: 3
  storage:
    size: 50Gi
  imageName: ghcr.io/cloudnative-pg/postgresql:16
  resources:
    requests:
      cpu: "1"
      memory: 2Gi
    limits:
      cpu: "2"
      memory: 4Gi
```

### Sync State (stored in ConfigMap)

```typescript
// lib/types/sync.ts

interface SyncState {
  lastSync: string;        // ISO timestamp
  lastCommitSha: string;
  status: 'synced' | 'pending' | 'conflict' | 'error';
  clusters: {
    [key: string]: {       // key = namespace/cluster-name
      localSha: string;    // hash of local spec
      remoteSha: string;   // hash of git spec
      status: 'synced' | 'local-ahead' | 'remote-ahead' | 'conflict';
      lastModified: string;
    };
  };
}
```

---

## Phase 1: Git Service Foundation

**Goal:** Establish Git connectivity and basic read operations.

### Tasks

| ID | Task | Files | Test Criteria |
|----|------|-------|---------------|
| 1.1 | Create GitOps types | `lib/types/gitops.ts` | TypeScript compiles |
| 1.2 | Create Git service with GitHub API client | `lib/git.ts` | Unit tests pass |
| 1.3 | Add GitOps config API (CRUD) | `app/api/gitops/config/route.ts` | GET/POST/PUT work |
| 1.4 | Store config in ConfigMap | `lib/git.ts` | Config persists across restarts |
| 1.5 | Add secret management for git auth | `app/api/gitops/auth/route.ts` | Token stored securely |
| 1.6 | Test repository connectivity | `app/api/gitops/test/route.ts` | Returns repo metadata |

### API Endpoints

```
GET  /api/gitops/config        # Get current config
POST /api/gitops/config        # Create/update config
POST /api/gitops/auth          # Store git credentials
POST /api/gitops/test          # Test repository connection
```

### Implementation Notes

```typescript
// lib/git.ts - Core git operations via GitHub REST API

import { Octokit } from '@octokit/rest';

export class GitService {
  private octokit: Octokit;
  private config: GitOpsConfig;

  async getFile(path: string): Promise<{ content: string; sha: string }>;
  async putFile(path: string, content: string, message: string): Promise<void>;
  async listFiles(path: string): Promise<string[]>;
  async testConnection(): Promise<{ valid: boolean; error?: string }>;
}
```

**Dependencies to add:** `@octokit/rest`

---

## Phase 2: Read from Git (Pull)

**Goal:** Display git-sourced clusters in UI, detect drift.

### Tasks

| ID | Task | Files | Test Criteria |
|----|------|-------|---------------|
| 2.1 | Implement file listing from git repo | `lib/git.ts` | Lists cluster YAMLs |
| 2.2 | Parse cluster YAML to typed objects | `lib/git.ts` | Parses valid CNPG spec |
| 2.3 | Create sync state management | `lib/sync.ts` | State persisted in ConfigMap |
| 2.4 | Add git clusters API endpoint | `app/api/gitops/clusters/route.ts` | Returns clusters from git |
| 2.5 | Add drift detection (compare k8s vs git) | `lib/sync.ts` | Detects add/modify/delete |
| 2.6 | Show git sync status in cluster list UI | `app/clusters/page.tsx` | Badge shows sync state |

### API Endpoints

```
GET /api/gitops/clusters                    # List clusters from git
GET /api/gitops/clusters/[ns]/[name]        # Get single cluster from git
GET /api/gitops/drift                       # Compare k8s state vs git
```

### UI Changes

Add to cluster list:
- Sync status badge (synced/pending/conflict)
- "Last synced" timestamp
- Filter by sync status

---

## Phase 3: Write to Git (Push)

**Goal:** UI changes commit to git automatically or on-demand.

### Tasks

| ID | Task | Files | Test Criteria |
|----|------|-------|---------------|
| 3.1 | Generate YAML from cluster spec | `lib/yaml.ts` | Clean YAML output |
| 3.2 | Implement commit with message template | `lib/git.ts` | Commits appear in repo |
| 3.3 | Hook cluster create API to git push | `app/api/clusters/route.ts` | Create triggers commit |
| 3.4 | Hook cluster update API to git push | `app/api/clusters/[ns]/[name]/route.ts` | Update triggers commit |
| 3.5 | Hook cluster delete to git (remove file) | `app/api/clusters/[ns]/[name]/route.ts` | Delete removes file |
| 3.6 | Add manual "push to git" action | `app/api/gitops/push/route.ts` | Single cluster push |
| 3.7 | Add bulk push all clusters | `app/api/gitops/push-all/route.ts` | Exports all to git |

### API Endpoints

```
POST /api/gitops/push                       # Push specific cluster to git
POST /api/gitops/push-all                   # Push all clusters to git
```

### Hook Pattern

```typescript
// Modified cluster creation flow
export async function POST(request: Request) {
  const cluster = await request.json();

  // 1. Create in Kubernetes (existing)
  await createCluster(cluster);

  // 2. Push to Git (new)
  const gitConfig = await getGitOpsConfig();
  if (gitConfig?.enabled && gitConfig.sync.autoCommit) {
    await gitService.pushCluster(cluster, 'Create cluster');
  }

  return NextResponse.json({ success: true });
}
```

---

## Phase 4: Pull from Git (Apply)

**Goal:** Apply git changes to Kubernetes cluster.

### Tasks

| ID | Task | Files | Test Criteria |
|----|------|-------|---------------|
| 4.1 | Implement apply single cluster from git | `lib/sync.ts` | Creates/updates k8s resource |
| 4.2 | Implement bulk apply from git | `lib/sync.ts` | All git clusters applied |
| 4.3 | Add apply API endpoint | `app/api/gitops/apply/route.ts` | POST triggers apply |
| 4.4 | Add dry-run mode | `app/api/gitops/apply/route.ts` | Preview changes |
| 4.5 | Handle deletions (orphan detection) | `lib/sync.ts` | Optionally delete orphans |
| 4.6 | Add UI for manual apply | `app/gitops/page.tsx` | Button triggers apply |

### API Endpoints

```
POST /api/gitops/apply                      # Apply changes from git
  body: {
    clusters?: string[],   # specific clusters, or all if empty
    dryRun?: boolean,
    deleteOrphans?: boolean
  }
```

---

## Phase 5: GitOps Settings UI

**Goal:** Complete GitOps configuration page.

### Tasks

| ID | Task | Files | Test Criteria |
|----|------|-------|---------------|
| 5.1 | Create repository connection form | `app/gitops/page.tsx` | Form validates input |
| 5.2 | Add authentication flow (PAT/App) | `app/gitops/page.tsx` | Token stored securely |
| 5.3 | Add connection test with feedback | `app/gitops/page.tsx` | Shows success/error |
| 5.4 | Create sync settings panel | `app/gitops/page.tsx` | Mode/interval configurable |
| 5.5 | Add sync status dashboard | `app/gitops/page.tsx` | Shows all cluster states |
| 5.6 | Add manual sync triggers | `app/gitops/page.tsx` | Push/pull buttons work |
| 5.7 | Show recent sync history | `app/gitops/page.tsx` | Lists last N operations |

### UI Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ GitOps Configuration                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Repository Settings                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Repository URL: [https://github.com/org/cnpg-configs ] │ │
│ │ Branch:         [main                               ] │ │
│ │ Path Prefix:    [clusters/                          ] │ │
│ │ K8s Cluster ID: [production-us-east-1               ] │ │
│ │                                                       │ │
│ │ [Test Connection]  Status: ✓ Connected                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Sync Settings                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Mode: ( ) Push only  (•) Pull only  ( ) Bidirectional  │ │
│ │ Auto-sync interval: [5 minutes ▼]                      │ │
│ │ Auto-commit UI changes: [✓]                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Sync Status                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Last sync: 2 minutes ago (abc1234)                     │ │
│ │                                                         │ │
│ │ Cluster            Namespace    Status      Action     │ │
│ │ ──────────────────────────────────────────────────────  │ │
│ │ postgres-main      production   ✓ Synced    -          │ │
│ │ postgres-replica   production   ⚠ Drift     [Sync]     │ │
│ │ analytics-db       staging      + Local     [Push]     │ │
│ │ temp-cluster       dev          - Remote    [Pull]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Push All to Git]  [Pull All from Git]  [Sync Now]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 6: Background Sync (Optional)

**Goal:** Automatic periodic synchronization.

### Tasks

| ID | Task | Files | Test Criteria |
|----|------|-------|---------------|
| 6.1 | Create sync scheduler | `lib/scheduler.ts` | Runs at configured interval |
| 6.2 | Implement webhook receiver | `app/api/gitops/webhook/route.ts` | GitHub webhook triggers sync |
| 6.3 | Add sync lock mechanism | `lib/sync.ts` | Prevents concurrent syncs |
| 6.4 | Add sync event logging | `lib/sync.ts` | Events stored in ConfigMap |
| 6.5 | Add notification on conflicts | `lib/sync.ts` | Logs/alerts on conflict |

### Webhook Endpoint

```
POST /api/gitops/webhook        # GitHub/GitLab webhook receiver
  headers: X-Hub-Signature-256
  body: push event payload
```

---

## File Structure (Final)

```
lib/
├── k8s.ts              # (existing) Kubernetes client
├── git.ts              # NEW: Git service (Octokit)
├── sync.ts             # NEW: Sync logic
├── yaml.ts             # NEW: YAML serialization
├── scheduler.ts        # NEW: Background sync (Phase 6)
└── types/
    ├── gitops.ts       # NEW: GitOps types
    └── sync.ts         # NEW: Sync state types

app/api/
├── clusters/           # (existing)
├── gitops/
│   ├── config/
│   │   └── route.ts    # NEW: GitOps config CRUD
│   ├── auth/
│   │   └── route.ts    # NEW: Git auth management
│   ├── test/
│   │   └── route.ts    # NEW: Connection test
│   ├── clusters/
│   │   └── route.ts    # NEW: List clusters from git
│   ├── drift/
│   │   └── route.ts    # NEW: Drift detection
│   ├── push/
│   │   └── route.ts    # NEW: Push to git
│   ├── push-all/
│   │   └── route.ts    # NEW: Bulk push
│   ├── apply/
│   │   └── route.ts    # NEW: Apply from git
│   └── webhook/
│       └── route.ts    # NEW: Webhook receiver (Phase 6)

app/gitops/
└── page.tsx            # (modify existing stub)

components/
├── gitops/
│   ├── ConfigForm.tsx      # NEW: Repository config form
│   ├── SyncStatus.tsx      # NEW: Sync status table
│   └── SyncBadge.tsx       # NEW: Inline sync badge
```

---

## Environment Variables

```bash
# Optional - for server-side git operations without user token
GITHUB_TOKEN=ghp_xxxx           # Fallback GitHub PAT
GITLAB_TOKEN=glpat_xxxx         # Fallback GitLab PAT

# Required for webhook verification
GITOPS_WEBHOOK_SECRET=secret    # Webhook signature secret
```

---

## RBAC Updates

Add to `deploy/manifests.yaml`:

```yaml
# Additional permissions for GitOps
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
  # For storing gitops config and sync state
```

---

## Agent Implementation Guide

### Per-Phase Checklist

Each phase should be implemented as follows:

1. **Start:** Read this design doc + existing code
2. **Types first:** Create/update TypeScript interfaces
3. **Service layer:** Implement core logic in `lib/`
4. **API routes:** Expose via Next.js API routes
5. **UI last:** Add components and pages
6. **Test:** Verify with curl/UI before marking complete

### Task Granularity

Tasks are sized for ~30-60 min agent sessions:
- Each task has clear input/output
- Tasks within a phase can be parallelized where noted
- Cross-phase dependencies are documented

### Testing Commands

```bash
# Phase 1: Test connection
curl -X POST http://localhost:3000/api/gitops/test \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/org/repo","token":"ghp_xxx"}'

# Phase 2: List git clusters
curl http://localhost:3000/api/gitops/clusters

# Phase 3: Push cluster
curl -X POST http://localhost:3000/api/gitops/push \
  -H "Content-Type: application/json" \
  -d '{"namespace":"production","name":"my-cluster"}'

# Phase 4: Apply from git
curl -X POST http://localhost:3000/api/gitops/apply \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'
```

---

## Conflict Resolution Strategy

When git and k8s state differ:

| Scenario | Push Mode | Pull Mode | Bidirectional |
|----------|-----------|-----------|---------------|
| Local change, no remote | Push | Ignore | Push |
| Remote change, no local | Ignore | Pull | Pull |
| Both changed | Push (overwrite) | Pull (overwrite) | **Conflict** |
| Deleted locally | Delete remote | Recreate local | Ask user |
| Deleted remotely | Recreate remote | Delete local | Ask user |

Conflicts require manual resolution via UI.

---

## Security Considerations

1. **Token storage:** Git tokens stored in K8s Secrets, not ConfigMaps
2. **Webhook verification:** Validate GitHub signature before processing
3. **RBAC scoping:** Git service account limited to specific repo/paths
4. **Audit logging:** Log all git operations for compliance
5. **Secret masking:** Never log or return tokens in API responses

---

## Open Questions

1. Support for GitLab/Bitbucket in addition to GitHub?
2. Should deleted clusters be moved to `_archive/` instead of removed?
3. Multi-cluster support (manage multiple k8s clusters from one UI)?
4. PR workflow (changes create PRs instead of direct commits)?

---

## Summary

| Phase | Scope | Dependencies | Effort |
|-------|-------|--------------|--------|
| 1 | Git foundation | `@octokit/rest` | 2-3 sessions |
| 2 | Pull from git | Phase 1 | 2-3 sessions |
| 3 | Push to git | Phase 1 | 2-3 sessions |
| 4 | Apply from git | Phase 2 | 2 sessions |
| 5 | Settings UI | Phase 1-4 | 2-3 sessions |
| 6 | Background sync | Phase 1-4 | 2 sessions |
