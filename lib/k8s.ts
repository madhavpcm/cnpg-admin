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
        _kc = new k8s.KubeConfig();
        _kc.loadFromDefault(); // in-cluster or ~/.kube/config
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

export async function listClusters(ns: string) {
    const api = getCustomApi();
    const res = await api.listNamespacedCustomObject({
        group: CLUSTERS_GROUP,
        version: CLUSTERS_VERSION,
        namespace: ns,
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
    if (!pods.items?.length) throw new Error('No pods found for cluster');
    const podName = pods.items[0].metadata!.name!;
    const logs = await coreApi.readNamespacedPodLog({
        name: podName,
        namespace: ns,
        container: 'postgres',
        tailLines: 100,
    });
    return logs as unknown as string;
}
