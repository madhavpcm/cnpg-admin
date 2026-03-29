/**
 * Kubernetes client for Next.js API routes.
 */

import * as k8s from '@kubernetes/client-node';

export const isMock = process.env.MOCK === 'true';
export const namespace = process.env.K8S_NAMESPACE ?? 'cnpg-system';

const CLUSTERS_GROUP = 'postgresql.cnpg.io';
const CLUSTERS_VERSION = 'v1';
const CLUSTERS_PLURAL = 'clusters';

let _kc: k8s.KubeConfig | null = null;
let _customApi: k8s.CustomObjectsApi | null = null;
let _coreApi: k8s.CoreV1Api | null = null;

function getKubeConfig(): k8s.KubeConfig {
    if (!_kc) {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        const cluster = kc.getCurrentCluster();

        if (cluster) {
            let serverUrl = process.env.K8S_SERVER;
            if (!serverUrl && process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
                serverUrl = `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`;
            }
            if (!serverUrl) serverUrl = cluster.server;

            if (serverUrl.startsWith('http:')) {
                serverUrl = serverUrl.replace('http:', 'https:');
            } else if (!serverUrl.startsWith('https:')) {
                serverUrl = `https://${serverUrl}`;
            }

            const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fs = require('fs');
            let token: string | undefined;

            try {
                if (fs.existsSync(tokenPath)) {
                    token = fs.readFileSync(tokenPath, 'utf8').trim();
                }
            } catch (err) {
                console.warn(`[k8s] Failed to read token from ${tokenPath}:`, err);
            }

            const clusterIdx = kc.clusters.findIndex((c) => c.name === cluster.name);
            const currentUser = kc.getCurrentUser();

            if (clusterIdx !== -1) {
                kc.clusters[clusterIdx] = {
                    ...kc.clusters[clusterIdx],
                    server: serverUrl,
                    skipTLSVerify: true,
                };
            }

            if (token) {
                if (currentUser) {
                    const userIdx = kc.users.findIndex((u) => u.name === currentUser.name);
                    if (userIdx !== -1) {
                        kc.users[userIdx] = { ...kc.users[userIdx], token };
                    }
                } else {
                    const userName = 'mirrord-user';
                    kc.users.push({ name: userName, token });
                    const ctxIdx = kc.contexts.findIndex((c) => c.name === kc.currentContext);
                    if (ctxIdx !== -1) {
                        kc.contexts[ctxIdx] = { ...kc.contexts[ctxIdx], user: userName };
                    }
                }
            }
        }
        _kc = kc;
    }
    return _kc;
}

export function getCustomApi(): k8s.CustomObjectsApi {
    if (!_customApi) {
        _customApi = getKubeConfig().makeApiClient(k8s.CustomObjectsApi);
    }
    return _customApi;
}

export function getCoreApi(): k8s.CoreV1Api {
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
        name,
    });
    return (res as any);
}

export async function createCluster(ns: string, body: object) {
    const api = getCustomApi();
    return api.createNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        body,
    });
}

export async function deleteCluster(ns: string, name: string) {
    const api = getCustomApi();
    return api.deleteNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        name,
    });
}

export async function patchCluster(ns: string, name: string, patch: object) {
    const api = getCustomApi();
    return api.patchNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        name,
        body: patch,
    });
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
    // Try superuser secret first for admin access
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
            if (dbname === '*') dbname = 'app'; // '*' means all DBs in CNPG superuser secret, but we must pick one to connect

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

    // Fallback to defaults
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
