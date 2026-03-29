import { NextResponse } from 'next/server';
import { isMock, mockUsers } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json(mockUsers);
    }
    try {
        // Real implementation: query k8s secrets for CNPG-managed users
        return NextResponse.json([]);
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/users] GET failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json({}, { status: 201 });
    }
    try {
        const _body = await req.json();
        return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/users] POST failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
