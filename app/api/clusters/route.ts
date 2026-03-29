import { NextResponse } from 'next/server';
import { isMock, mockClusters, listClusters, createCluster, namespace } from '@/lib/k8s';
import { discoverGitOpsStatus } from '@/lib/gitops/detector';

export async function GET() {
    if (isMock) {
        return NextResponse.json(await Promise.all(mockClusters.map(async c => ({
            ...c,
            gitops: await discoverGitOpsStatus(c)
        }))));
    }
    try {
        const items = await listClusters();
        const enriched = await Promise.all(items.map(async (c: any) => ({
            ...c,
            gitops: await discoverGitOpsStatus(c)
        })));
        console.log(`[/api/clusters] Found ${enriched.length} enriched clusters`);
        return NextResponse.json(enriched);
    } catch (e) {
        console.error('[/api/clusters] GET failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (isMock) {
        return NextResponse.json({}, { status: 201 });
    }
    try {
        const body = await req.json();
        const targetNamespace = body.namespace || namespace;
        console.log(`[/api/clusters] Creating cluster ${body.metadata?.name} in namespace ${targetNamespace}`);
        await createCluster(targetNamespace, body);
        return NextResponse.json({}, { status: 201 });
    } catch (e) {
        console.error('[/api/clusters] POST failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
