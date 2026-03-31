import { NextResponse } from 'next/server';
import {
    isMock,
    mockClusters,
    getCluster,
    deleteCluster,
} from '@/lib/k8s';
import { discoverGitOpsStatus } from '@/lib/gitops/detector';
import { driftReconciler } from '@/lib/gitops/reconciler';
import { patchCluster } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        const cluster = mockClusters.find(
            (c) => c.metadata.name === name && c.metadata.namespace === namespace
        ) ?? mockClusters[0];
        const enriched = { ...cluster, metadata: { ...cluster.metadata, name, namespace } };
        return NextResponse.json({
            ...enriched,
            gitops: await discoverGitOpsStatus(enriched)
        });
    }
    try {
        const data = await getCluster(namespace, name);
        return NextResponse.json({
            ...data,
            gitops: await discoverGitOpsStatus(data)
        });
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}] GET failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 404 });
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return new Response(null, { status: 204 });
    }
    try {
        await deleteCluster(namespace, name);
        await driftReconciler.triggerReconciliation();
        return new Response(null, { status: 204 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json({ ok: true });
    }
    try {
        const body = await req.json();
        // Assume body is the merge patch
        const res = await patchCluster(namespace, name, body);
        await driftReconciler.triggerReconciliation();
        return NextResponse.json(res);
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}] PATCH failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
