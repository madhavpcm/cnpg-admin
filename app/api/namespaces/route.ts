import { NextResponse } from 'next/server';
import { isMock, listNamespaces, namespace } from '@/lib/k8s';

export async function GET() {
    if (isMock) {
        return NextResponse.json(['default', 'cnpg-system', 'staging', 'production']);
    }
    try {
        const namespaces = await listNamespaces();
        const names = namespaces.map((ns: any) => ns.metadata?.name).filter(Boolean);
        return NextResponse.json(names);
    } catch (e) {
        console.warn('[/api/namespaces] GET failed (probably RBAC), using fallback:', e);
        // Fallback to common namespaces + current one
        const fallback = Array.from(new Set(['default', 'cnpg-system', namespace]));
        return NextResponse.json(fallback);
    }
}
