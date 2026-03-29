import { NextResponse } from 'next/server';
import { getCluster } from '@/lib/k8s';
import { getGitOpsStatus } from '@/lib/gitops/detector';
import { resolvePath } from '@/lib/gitops/resolver';
import { patchYaml } from '@/lib/gitops/patcher';

export async function POST(req: Request) {
    try {
        const { namespace, name, field, value } = await req.json();

        const cluster = await getCluster(namespace, name);
        const gitops = getGitOpsStatus(cluster.metadata);

        if (gitops.status === 'NOT_GITOPS') {
            return NextResponse.json({ error: 'Cluster is not managed by GitOps' }, { status: 400 });
        }

        // Layer 0-2 resolution
        const resolution = await resolvePath(cluster.metadata, gitops);

        // Fetch original content (using raw API for public repo testing)
        const rawUrl = gitops.repoUrl!
            .replace('github.com', 'raw.githubusercontent.com')
            .replace(/\.git$/, '') + `/${gitops.branch || 'main'}/${resolution.file}`;

        const resp = await fetch(rawUrl);
        const originalContent = await resp.text();

        // Final dots path for patching
        const fullKeyPath = `${resolution.keyPath}.${field}`;
        const newContent = patchYaml(originalContent, fullKeyPath, value);

        return NextResponse.json({
            file: resolution.file,
            keyPath: fullKeyPath,
            diff: `Diff for ${resolution.file}: ${field} -> ${value}`,
            newContent,
        });
    } catch (e) {
        console.error('[/api/gitops/propose] POST failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
