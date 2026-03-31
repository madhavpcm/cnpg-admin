export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getCoreApi } from '@/lib/k8s';
import * as zlib from 'zlib';

export async function GET() {
    const coreApi = getCoreApi();
    try {
        // Helm stores releases in secrets with label owner=helm
        const res = await coreApi.listSecretForAllNamespaces({
            labelSelector: 'owner=helm',
        });

        const secrets = (res as any).items || [];
        const releases = secrets.map((secret: any) => {
            try {
                const base64Data = secret.data?.release;
                if (!base64Data) return null;

                const compressed = Buffer.from(base64Data, 'base64');
                const decompressed = zlib.gunzipSync(compressed);
                const release = JSON.parse(decompressed.toString('utf8'));

                return {
                    name: release.name,
                    namespace: release.namespace,
                    version: release.version,
                    status: release.info?.status,
                    chart: release.chart?.metadata?.name,
                    chartVersion: release.chart?.metadata?.version,
                    updated: release.info?.last_deployed,
                };
            } catch (err) {
                console.warn(`[helm] Failed to decode release secret ${secret.metadata?.name}:`, err);
                return null;
            }
        }).filter(Boolean);

        // Sort by name and then version decending
        releases.sort((a: any, b: any) => {
            if (a.name !== b.name) return a.name.localeCompare(b.name);
            return b.version - a.version;
        });

        // Deduplicate to show only latest version of each release
        const latestReleases = [];
        const seen = new Set();
        for (const r of releases) {
            const key = `${r.namespace}/${r.name}`;
            if (!seen.has(key)) {
                latestReleases.push(r);
                seen.add(key);
            }
        }

        return NextResponse.json(latestReleases);
    } catch (e: any) {
        console.error('[helm] API failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
