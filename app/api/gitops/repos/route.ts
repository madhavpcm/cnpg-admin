import { NextResponse } from 'next/server';
import { listRepos } from '@/lib/gitops/storage';
import { isMock } from '@/lib/k8s';

export async function GET() {
    try {
        if (isMock) {
            return NextResponse.json([
                { id: 'mock-id', url: 'https://github.com/cloudnative-pg/charts', branch: 'main' }
            ]);
        }

        const repos = await listRepos();
        return NextResponse.json(repos);
    } catch (e) {
        console.error('[/api/gitops/repos] GET failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
