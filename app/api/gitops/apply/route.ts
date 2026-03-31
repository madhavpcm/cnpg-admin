export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitService } from '@/lib/git';
import { SyncService } from '@/lib/sync';

export async function POST(request: Request) {
    try {
        const { namespace, name } = await request.json();
        const gitService = await getGitService();
        if (!gitService) throw new Error('GitOps not configured');

        const syncService = new SyncService(gitService);
        await syncService.applyFromGit(namespace, name);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
