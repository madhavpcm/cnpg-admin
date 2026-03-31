export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitService } from '@/lib/git';
import { SyncService } from '@/lib/sync';

export async function GET() {
    try {
        const gitService = await getGitService();
        if (!gitService) {
            return NextResponse.json({
                lastSync: new Date().toISOString(),
                clusters: {}
            });
        }

        const syncService = new SyncService(gitService);
        const status = await syncService.getSyncStatus();
        return NextResponse.json(status);
    } catch (error: any) {
        console.error('[api/gitops/drift] GET failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
