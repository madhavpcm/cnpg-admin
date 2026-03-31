export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { saveGitToken } from '@/lib/k8s';

export async function POST(request: Request) {
    try {
        const { token } = await request.json();
        if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

        await saveGitToken(token);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[api/gitops/auth] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
