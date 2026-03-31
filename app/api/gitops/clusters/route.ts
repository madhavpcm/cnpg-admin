export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitService } from '@/lib/git';

export async function GET() {
    try {
        const gitService = await getGitService();
        if (!gitService) {
            return NextResponse.json([]);
        }

        const clusters = await gitService.listClusters();
        return NextResponse.json(clusters);
    } catch (error: any) {
        console.error('[api/gitops/clusters] GET failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
