import { NextResponse } from 'next/server';
import { isMock, updateClusterUser } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string; username: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
    const { namespace, name, username } = await params;
    if (isMock) {
        return NextResponse.json({ success: true });
    }
    try {
        const body = await req.json();
        const updates: any = {};
        if (typeof body.login === 'boolean') updates.login = body.login;
        if (typeof body.superuser === 'boolean') updates.superuser = body.superuser;

        await updateClusterUser(namespace, name, username, updates);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/users/${username}] PATCH failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
