export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitService } from '@/lib/git';
import { SyncService } from '@/lib/sync';
import { getCluster } from '@/lib/k8s';

export async function POST(request: Request) {
    try {
        const { namespace, name, message } = await request.json();
        const gitService = await getGitService();
        if (!gitService) throw new Error('GitOps not configured');

        const syncService = new SyncService(gitService);
        const cluster = await getCluster(namespace, name);
        await syncService.pushToGit(namespace, name, cluster, message);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
