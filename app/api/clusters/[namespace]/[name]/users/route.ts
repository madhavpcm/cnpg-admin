import { NextResponse } from 'next/server';
import { isMock, mockUsers } from '@/lib/k8s';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params: _params }: Params) {
    if (isMock) {
        return NextResponse.json(mockUsers);
    }
    // Real implementation: query k8s secrets for CNPG-managed users
    return NextResponse.json([]);
}

export async function POST(req: Request, { params: _params }: Params) {
    if (isMock) {
        return NextResponse.json({}, { status: 201 });
    }
    const _body = await req.json();
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
