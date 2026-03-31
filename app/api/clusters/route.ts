export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { isMock, mockClusters, listClusters, createCluster, namespace as defaultNamespace } from '@/lib/k8s';
import { getGitService } from '@/lib/git';
import { SyncService } from '@/lib/sync';

export async function GET(request: Request) {
    if (isMock) return NextResponse.json(mockClusters);

    const { searchParams } = new URL(request.url);
    const ns = searchParams.get('namespace'); // Pass null to listClusters for all namespaces

    try {
        const clusters = await listClusters(ns || undefined);
        console.log(`[/api/clusters] Found ${clusters.length} enriched clusters`);
        return NextResponse.json(clusters);
    } catch (e: any) {
        console.error('[/api/clusters] GET failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const ns = body.metadata?.namespace || defaultNamespace;

        // 1. Create in K8s
        const result = await createCluster(ns, body);

        // 2. Push to Git if enabled
        const gitService = await getGitService();
        if (gitService) {
            const syncService = new SyncService(gitService);
            try {
                await syncService.pushToGit(ns, body.metadata.name, body, `Create cluster ${body.metadata.name} via UI`);
                console.log(`[gitops] Successfully pushed new cluster ${body.metadata.name} to git`);
            } catch (err) {
                console.warn(`[gitops] Failed to push new cluster to git: ${err}`);
            }
        }

        return NextResponse.json(result);
    } catch (e: any) {
        console.error('[/api/clusters] POST failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
