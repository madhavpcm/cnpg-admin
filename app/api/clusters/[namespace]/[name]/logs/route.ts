import { NextResponse, NextRequest } from 'next/server';
import { isMock, mockLogs, getPodLogs, getCoreApi } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
    const { namespace, name } = await params;
    const { searchParams } = new URL(req.url);
    const podNameParam = searchParams.get('pod');

    if (isMock) {
        return new Response(mockLogs, { headers: { 'Content-Type': 'text/plain' } });
    }
    try {
        let podName = podNameParam;
        if (!podName) {
            const pods = await getCoreApi().listNamespacedPod({
                namespace,
                labelSelector: `cnpg.io/cluster=${name}`,
            });
            const items = (pods as any).items ?? [];
            if (!items.length) throw new Error('No pods found for cluster');
            podName = items[0].metadata!.name!;
        }

        const logs = await getPodLogs(namespace, podName!);
        return new Response(logs, { headers: { 'Content-Type': 'text/plain' } });
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/logs] GET failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
