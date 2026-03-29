/**
 * Kubernetes client for Next.js API routes.
 * - In-cluster: uses ServiceAccount token automatically
 * - Local dev: uses ~/.kube/config
 * - MOCK=true: returns mock data without k8s connection
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
        // Log environment for mirrord debugging
        Object.keys(process.env)
            .filter((k) => k.startsWith('KUBERNETES_') || k.startsWith('MIRRORD_'))
            .forEach((k) => console.log(`[env] ${k}=${k.includes('TOKEN') ? '***' : process.env[k]}`));

        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        const cluster = kc.getCurrentCluster();

        if (cluster) {
            console.log(`[k8s] Detected Cluster Server from KubeConfig: ${cluster.server}`);

            let serverUrl = process.env.K8S_SERVER;
            if (!serverUrl && process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
                serverUrl = `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`;
            }
            if (!serverUrl) serverUrl = cluster.server;

            // Normalize protocol
            if (serverUrl.startsWith('http:')) {
                serverUrl = serverUrl.replace('http:', 'https:');
            } else if (!serverUrl.startsWith('https:')) {
                serverUrl = `https://${serverUrl}`;
            }

            // Manually check for in-cluster token if mirrord is active
            const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fs = require('fs');
            let token: string | undefined;

            try {
                if (fs.existsSync(tokenPath)) {
                    token = fs.readFileSync(tokenPath, 'utf8').trim();
                    console.log(`[k8s] Successfully read token from ${tokenPath}`);
                }
            } catch (err) {
                console.warn(`[k8s] Failed to read token from ${tokenPath}:`, err);
            }

            // Find current cluster/user indices to update
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
            console.log(`[k8s] Active API Server: ${kc.getCurrentCluster()?.server} (Token present: ${!!token})`);
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

// ---- Types ----

export interface ClusterInfo {
    name: string;
    namespace: string;
    status: string;
    instances: number;
    ready: number;
    imageName?: string;
    storage?: string;
    cpu?: string;
    memory?: string;
    phase?: string;
}

// ---- Mock data (mirrors Go handler.go mock) ----

export const mockClusters = [
    {
        metadata: { name: 'prod-db', namespace: 'default' },
        spec: {
            instances: 3,
            imageName: 'ghcr.io/cloudnative-pg/postgresql:16',
            storage: { size: '50Gi' },
            resources: { requests: { cpu: '2', memory: '4Gi' }, limits: { cpu: '4', memory: '8Gi' } },
        },
        status: { phase: 'Cluster in healthy state', readyInstances: 3 },
    },
    {
        metadata: { name: 'staging-db', namespace: 'staging' },
        spec: {
            instances: 1,
            imageName: 'ghcr.io/cloudnative-pg/postgresql:15',
            storage: { size: '10Gi' },
            resources: { requests: { cpu: '500m', memory: '1Gi' }, limits: { cpu: '1', memory: '2Gi' } },
        },
        status: { phase: 'Unhealthy', readyInstances: 0 },
    },
    {
        metadata: { name: 'analytics-db', namespace: 'analytics' },
        spec: {
            instances: 2,
            imageName: 'ghcr.io/cloudnative-pg/postgresql:14',
            storage: { size: '100Gi' },
            resources: { requests: { cpu: '4', memory: '16Gi' }, limits: { cpu: '8', memory: '32Gi' } },
        },
        status: { phase: 'Cluster in healthy state', readyInstances: 2 },
    },
];

export const mockUsers = [
    { username: 'admin', role: 'superuser', created_at: '2024-03-20' },
    { username: 'app_user', role: 'readwrite', created_at: '2024-03-21' },
];

export const mockLogs = `2024-03-29 01:50:14 INFO  Initializing database...
2024-03-29 01:50:15 INFO  Database is ready for connections.
2024-03-29 01:50:16 INFO  Received connection from 10.0.0.5
2024-03-29 01:50:17 DEBUG Executing query: SELECT * FROM users;`;

export const mockTables = ['users', 'orders', 'products', 'inventory'];

export const mockQueryResults = [
    { id: 1, name: 'admin', role: 'superuser' },
    { id: 2, name: 'app_user', role: 'readwrite' },
];

// ---- Real k8s helpers ----

export async function listClusters() {
    const api = getCustomApi();
    const res = await api.listCustomObjectForAllNamespaces({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        plural: CLUSTERS_PLURAL,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res as any).items ?? [];
}

export async function getCluster(ns: string, name: string) {
    const api = getCustomApi();
    return api.getNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
        plural: CLUSTERS_PLURAL,
        name,
    });
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

export async function getPodLogs(ns: string, clusterName: string): Promise<string> {
    const coreApi = getCoreApi();
    const pods = await coreApi.listNamespacedPod({
        namespace: ns,
        labelSelector: `cnpg.io/cluster=${clusterName}`,
    });
    const items = (pods as any).items ?? [];
    if (!items.length) throw new Error('No pods found for cluster');
    const podName = items[0].metadata!.name!;
    const logs = await coreApi.readNamespacedPodLog({
        name: podName,
        namespace: ns,
        container: 'postgres',
        tailLines: 100,
    });
    return logs as unknown as string;
}
