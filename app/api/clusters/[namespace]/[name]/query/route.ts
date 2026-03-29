import { NextResponse } from 'next/server';
import { isMock, mockQueryResults } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function POST(_req: Request, { params: _params }: Params) {
    if (isMock) {
        return NextResponse.json(mockQueryResults);
    }
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
