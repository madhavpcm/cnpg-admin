import { NextResponse } from 'next/server';
import { listReleases } from '@/lib/gitops/helm';
import { isMock } from '@/lib/k8s';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const ns = searchParams.get('namespace') || undefined;

        if (isMock) {
            return NextResponse.json([
                {
                    name: 'cnpg-cluster-prod',
                    namespace: 'default',
                    version: 1,
                    status: 'deployed',
                    chart: 'cluster',
                    chartVersion: '0.3.0',
                    values: { cluster: { instances: 3 } },
                    updated: new Date().toISOString()
                }
            ]);
        }

        const releases = await listReleases(ns);
        return NextResponse.json(releases);
    } catch (e) {
        console.error('[/api/helm/releases] GET failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
