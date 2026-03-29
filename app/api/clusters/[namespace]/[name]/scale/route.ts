import { NextResponse } from 'next/server';
import { isMock, patchCluster } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function POST(req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json({ ok: true });
    }
    try {
        const { instances } = await req.json();
        await patchCluster(namespace, name, { spec: { instances } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
