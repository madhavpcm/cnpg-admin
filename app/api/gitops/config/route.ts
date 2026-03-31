export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitOpsConfig, saveGitOpsConfig } from '@/lib/k8s';

export async function GET() {
    try {
        const config = await getGitOpsConfig();
        return NextResponse.json(config || { enabled: false });
    } catch (error: any) {
        const detail = error.response?.body || error.message;
        console.error('[api/gitops/config] GET error:', detail);
        return NextResponse.json({
            error: 'Failed to retrieve GitOps configuration',
            detail: detail
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const config = await request.json();
        console.log('[api/gitops/config] POST request received:', config);
        await saveGitOpsConfig(config);
        console.log('[api/gitops/config] POST successful');
        return NextResponse.json({ success: true });
    } catch (error: any) {
        const detail = error.response?.body || error.message;
        const statusCode = error.response?.statusCode || 500;
        console.error(`[api/gitops/config] POST error (status ${statusCode}):`, detail);
        return NextResponse.json({
            error: 'Failed to save GitOps configuration',
            detail: detail
        }, { status: statusCode });
    }
}
