import { NextResponse, NextRequest } from 'next/server';
import { isMock, mockLogs, getPodLogs } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return new Response(mockLogs, { headers: { 'Content-Type': 'text/plain' } });
    }
    try {
        const logs = await getPodLogs(namespace, name);
        return new Response(logs, { headers: { 'Content-Type': 'text/plain' } });
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/logs] GET failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
