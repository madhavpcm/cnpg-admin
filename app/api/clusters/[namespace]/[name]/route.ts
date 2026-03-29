import { NextResponse } from 'next/server';
import {
    isMock,
    mockClusters,
    getCluster,
    deleteCluster,
} from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        const cluster = mockClusters.find(
            (c) => c.metadata.name === name && c.metadata.namespace === namespace
        ) ?? mockClusters[0];
        return NextResponse.json({ ...cluster, metadata: { ...cluster.metadata, name, namespace } });
    }
    try {
        const data = await getCluster(namespace, name);
        return NextResponse.json(data);
    } catch (e) {
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
        return new Response(null, { status: 204 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
