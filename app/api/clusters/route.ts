import { NextResponse } from 'next/server';
import { isMock, mockClusters, listClusters, createCluster, namespace } from '@/lib/k8s';

export async function GET() {
    if (isMock) {
        return NextResponse.json(mockClusters);
    }
    try {
        const items = await listClusters();
        console.log(`[/api/clusters] Found ${items.length} clusters`);
        return NextResponse.json(items);
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
