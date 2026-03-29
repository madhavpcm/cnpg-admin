import { NextResponse } from 'next/server';
import { isMock, mockTables } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json(mockTables);
    }
    try {
        // Real implementation: query information_schema.tables
        return NextResponse.json([]);
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/tables] GET failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
