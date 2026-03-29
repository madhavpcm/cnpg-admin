#!/usr/bin/env bash
# Usage: ./seed_cluster.sh <namespace> <cluster_name> [num_tables]

NAMESPACE=${1:-default}
CLUSTER=${2:-dev}
NUM_TABLES=${3:-5}

# Find the primary pod
echo "▶ Working on cluster ${CLUSTER} in namespace ${NAMESPACE}..."
POD=$(kubectl get pod -n "${NAMESPACE}" -l cnpg.io/cluster="${CLUSTER}",role=primary -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD" ]; then
    echo "⚠️  Primary pod not found via role=primary, falling back to any pod..."
    POD=$(kubectl get pod -n "${NAMESPACE}" -l cnpg.io/cluster="${CLUSTER}" -o jsonpath='{.items[0].metadata.name}')
fi

if [ -z "$POD" ]; then
    echo "❌ Error: Could not find any pods for cluster ${CLUSTER}."
    exit 1
fi

echo "✅ Found pod: ${POD}"

# Get the database name from the cluster spec
DB=$(kubectl get cluster -n "${NAMESPACE}" "${CLUSTER}" -o jsonpath='{.spec.bootstrap.initdb.database}')
DB=${DB:-app}

echo "▶ Generating and executing SQL on database '${DB}'..."

# Generate SQL and pipe to psql
python3 "$(dirname "$0")/generate_data.py" "${NUM_TABLES}" | \
    kubectl exec -i "${POD}" -n "${NAMESPACE}" -- psql -U postgres -d "${DB}"

# Grant permissions to app user
echo "▶ Granting permissions to 'app' user..."
kubectl exec -i "${POD}" -n "${NAMESPACE}" -- psql -U postgres -d "${DB}" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app;"

echo "🏁 Done!"
