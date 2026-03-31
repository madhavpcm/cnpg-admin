import { NextResponse } from 'next/server';
import { saveRepo } from '@/lib/gitops/storage';
import { isMock, saveGitOpsConfig, saveGitToken, getGitOpsConfig } from '@/lib/k8s';

export async function POST(req: Request) {
    try {
        const { url, branch, token } = await req.json();
        if (!url || !branch) {
            return NextResponse.json({ error: 'URL and Branch are required' }, { status: 400 });
        }

        if (isMock) {
            console.log('[Mock] Connecting repo:', url);
            return NextResponse.json({ id: 'mock-id' }, { status: 201 });
        }

        // 1. Save to repo-specific secret
        const id = await saveRepo(url, branch, token);

        // 2. Also update global GitOps configuration to make it the active repo
        const currentConfig = await getGitOpsConfig();
        await saveGitOpsConfig({
            ...currentConfig,
            enabled: true,
            repoUrl: url,
            branch: branch,
            path: currentConfig?.path || 'clusters'
        });

        // 3. Update active token if provided
        if (token) {
            await saveGitToken(token);
        }

        console.log(`Repository ${url} connected and activated with ID ${id}`);

        return NextResponse.json({ id }, { status: 201 });
    } catch (e: any) {
        console.error('[/api/gitops/connect] POST failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
