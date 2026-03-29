import * as k8s from '@kubernetes/client-node';

const CLUSTERS_GROUP = 'postgresql.cnpg.io';
const CLUSTERS_VERSION = 'v1';
const CLUSTERS_PLURAL = 'clusters';

export const isMock = process.env.MOCK_K8S === 'true';
export const namespace = process.env.K8S_NAMESPACE ?? 'cnpg-system';

let _kc: k8s.KubeConfig | null = null;
function getKubeConfig() {
    if (!_kc) {
        _kc = new k8s.KubeConfig();
        if (process.env.KUBECONFIG) {
            _kc.loadFromFile(process.env.KUBECONFIG);
        } else {
            _kc.loadFromDefault();
        }
    }
    return _kc;
}

let _customApi: k8s.CustomObjectsApi | null = null;
function getCustomApi() {
    if (!_customApi) {
        _customApi = getKubeConfig().makeApiClient(k8s.CustomObjectsApi);
    }
    return _customApi;
}

let _coreApi: k8s.CoreV1Api | null = null;
export function getCoreApi() {
    if (!_coreApi) {
        _coreApi = getKubeConfig().makeApiClient(k8s.CoreV1Api);
    }
    return _coreApi;
}

// ---- Real k8s helpers ----

export async function listClusters() {
    const api = getCustomApi();
    const res = await api.listCustomObjectForAllNamespaces({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        plural: CLUSTERS_PLURAL,
    });
    return (res as any).items ?? [];
}

export async function getCluster(ns: string, name: string) {
    const api = getCustomApi();
    const res = await api.getNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        name: name,
    });
    return (res as any);
}

export async function patchCluster(ns: string, name: string, patch: object) {
    const api = getCustomApi();
    // @ts-ignore - headers in ConfigurationOptions not fully typed in this version
    return api.patchNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        name: name,
        body: patch,
    }, {
        headers: { 'Content-Type': 'application/merge-patch+json' }
    });
}

export async function updateClusterUser(ns: string, name: string, username: string, updates: Partial<{ login: boolean, superuser: boolean }>) {
    const cluster = await getCluster(ns, name);
    const roles = cluster.spec?.managed?.roles || [];
    const index = roles.findIndex((r: any) => r.name === username);
    if (index === -1) throw new Error(`User ${username} not found in managed roles`);

    const updatedRoles = [...roles];
    updatedRoles[index] = { ...updatedRoles[index], ...updates };

    const patch = {
        spec: {
            managed: {
                roles: updatedRoles
            }
        }
    };
    return patchCluster(ns, name, patch);
}

export function extractClusterUsers(cluster: any) {
    const roles = cluster.spec?.managed?.roles ?? [];
    return roles.map((r: any) => ({
        username: r.name,
        role: r.superuser ? 'superuser' : (r.login ? 'login' : 'nologin'),
        created_at: cluster.metadata?.creationTimestamp ?? 'Unknown',
    }));
}

export async function createCluster(ns: string, body: object) {
    const api = getCustomApi();
    return api.createNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        body: body,
    });
}

export async function deleteCluster(ns: string, name: string) {
    const api = getCustomApi();
    return api.deleteNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        name: name,
    });
}

export async function listNamespaces() {
    const coreApi = getCoreApi();
    const res = await coreApi.listNamespace();
    return (res as any).items ?? [];
}

export async function listPods(ns: string, clusterName: string) {
    const coreApi = getCoreApi();
    const res = await coreApi.listNamespacedPod({
        namespace: ns,
        labelSelector: `cnpg.io/cluster=${clusterName}`,
    });
    return (res as any).items ?? [];
}

export async function getPodLogs(ns: string, podName: string): Promise<string> {
    const coreApi = getCoreApi();
    const res = await coreApi.readNamespacedPodLog({
        name: podName,
        namespace: ns,
        container: 'postgres',
        tailLines: 100,
    });
    return res as unknown as string;
}

export async function getClusterCredentials(ns: string, clusterName: string) {
    const coreApi = getCoreApi();
    const secretNames = [`${clusterName}-superuser`, `${clusterName}-app`];

    for (const secretName of secretNames) {
        try {
            const res = await coreApi.readNamespacedSecret({
                name: secretName,
                namespace: ns,
            });
            const data = (res as any).data || {};
            const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf8');
            let dbname = decode(data.dbname || 'app');
            if (dbname === '*') dbname = 'app';

            return {
                username: decode(data.username || data.user || 'postgres'),
                password: decode(data.password || ''),
                dbname: dbname,
                host: `${clusterName}-rw.${ns}.svc`,
            };
        } catch (e) {
            console.warn(`[k8s] Failed to get secret ${secretName}, trying next...`);
        }
    }

    return {
        username: 'app',
        password: '',
        dbname: 'app',
        host: `${clusterName}-rw.${ns}.svc`,
    };
}

// ---- Mock data ----

export const mockClusters = [
    {
        metadata: { name: 'prod-db', namespace: 'default' },
        spec: { instances: 3, imageName: 'ghcr.io/cloudnative-pg/postgresql:16', storage: { size: '50Gi' } },
        status: { phase: 'Cluster in healthy state', readyInstances: 3 },
    },
];
export const mockUsers = [{ username: 'admin', role: 'superuser', created_at: '2024-03-20' }];
export const mockLogs = "2024-03-29 01:50:14 INFO Initializing database...";
export const mockTables = ['users', 'products', 'orders'];
export const mockQueryResults = [
    { id: 1, name: 'admin', role: 'superuser' },
    { id: 2, name: 'app_user', role: 'readwrite' },
];
