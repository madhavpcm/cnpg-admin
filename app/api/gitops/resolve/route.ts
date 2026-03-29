import { NextResponse } from 'next/server';
import { getCluster } from '@/lib/k8s';
import { getGitOpsStatus } from '@/lib/gitops/detector';
import { resolvePath } from '@/lib/gitops/resolver';
import path from 'path';

export async function POST(req: Request) {
    try {
        const { namespace, name, repoId } = await req.json();
        if (!namespace || !name) {
            return NextResponse.json({ error: 'Namespace and Name are required' }, { status: 400 });
        }

        const cluster = await getCluster(namespace, name);
        const gitops = getGitOpsStatus(cluster.metadata);

        // In testing, we might not have a real repoDir yet.
        // For serverless/ephemeral, we would have a path based on repoId.
        const mockRepoDir = repoId ? `/tmp/cnpg-gitops-clones/${repoId}` : undefined;

        const result = await resolvePath(cluster.metadata, gitops, mockRepoDir);

        return NextResponse.json(result);
    } catch (e) {
        console.error('[/api/gitops/resolve] POST failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
