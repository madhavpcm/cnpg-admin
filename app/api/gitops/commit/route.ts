import { NextResponse } from 'next/server';
import { getCluster } from '@/lib/k8s';
import { getGitOpsStatus } from '@/lib/gitops/detector';
import { createPullRequest } from '@/lib/gitops/git-client';

export async function POST(req: Request) {
    try {
        const { namespace, name, field, value, newContent, file } = await req.json();

        const cluster = await getCluster(namespace, name);
        const gitops = getGitOpsStatus(cluster.metadata);

        if (gitops.status !== 'HELM_GITOPS') {
            return NextResponse.json({ error: 'GitOps is not fully connected' }, { status: 400 });
        }

        const commitMsg = `chore: update ${name} ${field} to ${value} via CNPG Admin`;
        const pr = await createPullRequest(
            gitops.repoUrl!,
            gitops.branch || 'main',
            file,
            newContent,
            commitMsg
        );

        return NextResponse.json(pr);
    } catch (e) {
        console.error('[/api/gitops/commit] POST failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
