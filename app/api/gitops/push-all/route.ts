export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitService } from '@/lib/git';
import { SyncService } from '@/lib/sync';
import { listClusters } from '@/lib/k8s';

export async function POST(request: Request) {
    try {
        const { message } = await request.json();
        const gitService = await getGitService();
        if (!gitService) throw new Error('GitOps not configured');

        const syncService = new SyncService(gitService);
        const clusters = await listClusters();

        for (const cluster of clusters) {
            await syncService.pushToGit(cluster.metadata.namespace, cluster.metadata.name, cluster, message);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
