import { getCoreApi, namespace as defaultNamespace } from '@/lib/k8s';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

export interface HelmRelease {
    name: string;
    namespace: string;
    version: number;
    status: string;
    chart: string;
    chartVersion: string;
    values: any;
    updated: string;
}

/**
 * Decodes the base64 gzipped JSON payload from a Helm secret
 */
export async function decodeRelease(base64Data: string): Promise<any> {
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const decompressed = await gunzip(buffer);
        return JSON.parse(decompressed.toString('utf-8'));
    } catch (e) {
        console.error('[helm] Failed to decode release data:', e);
        throw e;
    }
}

/**
 * Lists Helm releases in a namespace (or all if not specified)
 */
export async function listReleases(namespace?: string): Promise<HelmRelease[]> {
    try {
        const coreApi = getCoreApi();
        const res = namespace
            ? await coreApi.listNamespacedSecret({
                namespace,
                labelSelector: 'owner=helm'
            })
            : await coreApi.listSecretForAllNamespaces({
                labelSelector: 'owner=helm'
            });

        const releases: HelmRelease[] = [];

        for (const secret of res.items) {
            if (!secret.data?.release) continue;

            try {
                const payload = await decodeRelease(secret.data.release);
                // Payload structure: { name, namespace, version, info: { status, last_deployed }, chart: { metadata: { name, version } }, config: { ...values } }

                releases.push({
                    name: payload.name,
                    namespace: payload.namespace,
                    version: payload.version,
                    status: payload.info?.status || 'unknown',
                    chart: payload.chart?.metadata?.name || 'unknown',
                    chartVersion: payload.chart?.metadata?.version || 'unknown',
                    values: payload.config || {},
                    updated: payload.info?.last_deployed || '',
                });
            } catch (e) {
                console.warn(`[helm] Skipping invalid release secret ${secret.metadata?.name}:`, e);
            }
        }

        // Sort by name and latest version first
        return releases.sort((a, b) => {
            if (a.name !== b.name) return a.name.localeCompare(b.name);
            return b.version - a.version;
        });
    } catch (e) {
        console.error('[helm] Failed to list releases:', e);
        return [];
    }
}

/**
 * Get a specific release by name and namespace
 */
export async function getRelease(name: string, namespace: string): Promise<HelmRelease | null> {
    const all = await listReleases(namespace);
    return all.find(r => r.name === name) || null;
}
