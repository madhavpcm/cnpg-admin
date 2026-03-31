# Helm Overrides Hierarchy

This directory contains standardized helm override values for CNPG clusters across different teams and environments.

## Directory Structure

```
helm-overrides/
├── team-a/
│   ├── values.yaml          # Base defaults for Team A
│   ├── staging/
│   │   └── values.yaml      # Staging overrides (extends base)
│   └── production/
│       └── values.yaml      # Production overrides (extends base)
└── team-b/
    ├── values.yaml          # Base defaults for Team B
    ├── staging/
    │   └── values.yaml      # Staging overrides (extends base)
    └── production/
        └── values.yaml      # Production overrides (extends base)
```

## Hierarchy Merge Order

When deploying, values are merged in this order (later files override earlier ones):

### Team A (base chart dependency approach)
```bash
# Uses helm's -f flag for layering
helm install release-name ../../charts/team-a \
  -f team-a/values.yaml \
  -f team-a/{environment}/values.yaml
```

### Team B (direct override approach)
```bash
# Similar merge pattern but with different value paths
helm install release-name ../../charts/team-b \
  -f team-b/values.yaml \
  -f team-b/{environment}/values.yaml
```

## Value Schema Differences

### Team A - Uses `cluster.*` hierarchy
```yaml
cluster:
  name: ""
  namespace: ""
  postgresql:
    version: ""
    image: ""
  instances: 3
  storage:
    size: ""
    storageClass: ""
  resources:
    limits:
      cpu: ""
      memory: ""
```

### Team B - Uses `cnpg.cluster.*` hierarchy
```yaml
cnpg:
  cluster:
    name: ""
    namespace: ""
    postgres:
      version: ""
      image: ""
    replicaCount: 3
    volume:
      capacity: ""
      class: ""
    compute:
      maxCpu: ""
      maxMemory: ""
```

## Usage Example

```bash
# Deploy Team A staging
helm upgrade --install team-a-staging test/charts/team-a \
  -f test/helm-overrides/team-a/values.yaml \
  -f test/helm-overrides/team-a/staging/values.yaml \
  --namespace team-a-staging

# Deploy Team B production
helm upgrade --install team-b-prod test/charts/team-b \
  -f test/helm-overrides/team-b/values.yaml \
  -f test/helm-overrides/team-b/production/values.yaml \
  --namespace team-b-production
```
