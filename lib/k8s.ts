import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import { GitOpsConfig } from './types/gitops';

const CLUSTERS_GROUP = 'postgresql.cnpg.io';
const CLUSTERS_VERSION = 'v1';
const CLUSTERS_PLURAL = 'clusters';

export const isMock = process.env.MOCK_K8S === 'true';
export const namespace = process.env.K8S_NAMESPACE ?? 'cnpg-system';
const GITOPS_NAMESPACE = 'cnpg-system';

let _kc: k8s.KubeConfig | null = null;
function getKubeConfig() {
    if (!_kc) {
        _kc = new k8s.KubeConfig();
        if (process.env.KUBECONFIG) {
            console.log('[k8s] Loading KubeConfig from file:', process.env.KUBECONFIG);
            _kc.loadFromFile(process.env.KUBECONFIG);
        } else {
            console.log('[k8s] Loading KubeConfig from default location');
            _kc.loadFromDefault();
        }

        const cluster = _kc.getCurrentCluster();
        if (cluster) {
            console.log('[k8s] Active Cluster:', cluster.name, '@', cluster.server);

            // Fix for mirrord/local dev
            if (process.env.NODE_ENV !== 'production' || process.env.K8S_SKIP_TLS_VERIFY === 'true') {
                (cluster as any).skipTLSVerify = true;
                if (cluster.server?.includes('//localhost:')) {
                    (cluster as any).server = cluster.server.replace('//localhost:', '//127.0.0.1:');
                    console.log('[k8s] Mapped localhost to 127.0.0.1:', cluster.server);
                }
            }
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

export async function listClusters(ns?: string) {
    const api = getCustomApi();

    if (ns && ns !== 'All Namespaces') {
        const res = await api.listNamespacedCustomObject({
            group: CLUSTERS_GROUP,
            version: CLUSTERS_VERSION,
            namespace: ns,
            plural: CLUSTERS_PLURAL,
        });
        return (res as any).items ?? [];
    }

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
    return api.patchNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        name: name,
        body: patch,
    }, {
        headers: { 'Content-Type': 'application/merge-patch+json' }
    } as any);
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

export async function applyCluster(ns: string, body: any) {
    const api = getCustomApi();
    const name = body.metadata.name;
    try {
        await getCluster(ns, name);
        // Exists, so patch
        return api.patchNamespacedCustomObject({
            group: CLUSTERS_GROUP,
            version: CLUSTERS_VERSION,
            namespace: ns,
            plural: CLUSTERS_PLURAL,
            name: name,
            body: body,
        }, {
            headers: { 'Content-Type': 'application/merge-patch+json' }
        } as any);
    } catch (e: any) {
        const statusCode = e.response?.statusCode || e.body?.code || e.code || e.status;
        if (statusCode === 404) {
            // Not found, so create
            return createCluster(ns, body);
        }
        throw e;
    }
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
    try {
        const res = await coreApi.listNamespace();
        return (res as any).items ?? [];
    } catch (e: any) {
        console.warn('[k8s] Failed to list namespaces, falling back to current namespace:', namespace, e.message);
        return [{ metadata: { name: namespace } }];
    }
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

// ---- GitOps Config & Secrets ----

const GITOPS_CONFIG_MAP = 'cnpg-admin-gitops-config';
const GITOPS_SECRET_NAME = 'cnpg-admin-gitops-auth';

const LOCAL_GITOPS_CONFIG_FILE = './.gitops-config.json';
const LOCAL_GITOPS_TOKEN_FILE = './.gitops-token.txt';

export async function getGitOpsConfig(): Promise<GitOpsConfig | null> {
    try {
        if (fs.existsSync(LOCAL_GITOPS_CONFIG_FILE)) {
            const data = fs.readFileSync(LOCAL_GITOPS_CONFIG_FILE, 'utf8');
            console.log('[k8s] getGitOpsConfig local raw data:', data);
            return JSON.parse(data);
        }
        return null;
    } catch (e: any) {
        console.error('[k8s] Failed to read local gitops config:', e);
        return null;
    }
}

export async function saveGitOpsConfig(config: GitOpsConfig) {
    const configData = JSON.stringify(config, null, 2);
    console.log('[k8s] saveGitOpsConfig writing locally:', configData);
    fs.writeFileSync(LOCAL_GITOPS_CONFIG_FILE, configData, 'utf8');
    return { metadata: { name: 'local-config' } };
}

export async function getGitToken(secretName?: string): Promise<string | null> {
    try {
        if (fs.existsSync(LOCAL_GITOPS_TOKEN_FILE)) {
            const data = fs.readFileSync(LOCAL_GITOPS_TOKEN_FILE, 'utf8');
            return data.trim();
        }
        return null;
    } catch (e: any) {
        return null;
    }
}

export async function saveGitToken(token: string, secretName?: string) {
    fs.writeFileSync(LOCAL_GITOPS_TOKEN_FILE, token, 'utf8');
    return { metadata: { name: 'local-token' } };
}

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
