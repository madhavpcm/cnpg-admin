import { NextResponse } from 'next/server';
import { isMock, listPods } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json([
            { metadata: { name: `${name}-1` }, status: { phase: 'Running' } },
            { metadata: { name: `${name}-2` }, status: { phase: 'Running' } },
        ]);
    }
    try {
        const pods = await listPods(namespace, name);
        return NextResponse.json(pods);
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/pods] GET failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
