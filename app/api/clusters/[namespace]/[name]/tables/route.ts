import { NextResponse } from 'next/server';
import { isMock, mockTables } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params: _params }: Params) {
    if (isMock) {
        return NextResponse.json(mockTables);
    }
    return NextResponse.json([]);
}
