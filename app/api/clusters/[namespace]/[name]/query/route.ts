import { NextResponse } from 'next/server';
import { isMock, mockQueryResults } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function POST(req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json(mockQueryResults);
    }
    try {
        // Real implementation would execute SQL in the cluster
        return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/query] POST failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
