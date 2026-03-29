import { NextResponse } from 'next/server';
import { isMock, namespace, mockClusters, listClusters, createCluster } from '@/lib/k8s';

export async function GET() {
    if (isMock) {
        return NextResponse.json(mockClusters);
    }
    try {
        const items = await listClusters(namespace);
        return NextResponse.json(items);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (isMock) {
        return NextResponse.json({}, { status: 201 });
    }
    try {
        const body = await req.json();
        await createCluster(namespace, body);
        return NextResponse.json({}, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
