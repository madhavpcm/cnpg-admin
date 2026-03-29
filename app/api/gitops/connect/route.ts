import { NextResponse } from 'next/server';
import { saveRepo } from '@/lib/gitops/storage';
import { isMock } from '@/lib/k8s';

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

        const id = await saveRepo(url, branch, token);

        // TODO: Trigger indexing in Phase 3
        console.log(`Repository ${url} connected with ID ${id}`);

        return NextResponse.json({ id }, { status: 201 });
    } catch (e) {
        console.error('[/api/gitops/connect] POST failed:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
