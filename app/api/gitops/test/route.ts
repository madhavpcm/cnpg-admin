export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitService } from '@/lib/git';

export async function GET() {
    try {
        const git = await getGitService();
        if (!git) {
            return NextResponse.json({ success: false, error: 'GitOps not configured' });
        }
        const ok = await git.testConnection();
        return NextResponse.json({ success: ok });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
