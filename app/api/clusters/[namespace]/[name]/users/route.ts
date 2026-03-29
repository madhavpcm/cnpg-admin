import { NextResponse } from 'next/server';
import { isMock, mockUsers, getCluster, extractClusterUsers } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json(mockUsers);
    }
    try {
        const cluster = await getCluster(namespace, name);
        const users = extractClusterUsers(cluster);
        return NextResponse.json(users);
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
