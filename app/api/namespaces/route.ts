export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { isMock, listNamespaces, namespace } from '@/lib/k8s';

export async function GET() {
    if (isMock) return NextResponse.json(['default', 'cnpg-system', 'production']);

    try {
        const nss = await listNamespaces();
        return NextResponse.json(nss.map((n: any) => n.metadata.name));
    } catch (e: any) {
        console.error('[/api/namespaces] GET failed:', e);
        // Fallback to the known namespace if list fails
        return NextResponse.json([namespace]);
    }
}
