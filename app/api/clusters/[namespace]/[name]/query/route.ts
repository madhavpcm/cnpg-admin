import { NextResponse } from 'next/server';
import { isMock, mockQueryResults, getClusterCredentials } from '@/lib/k8s';
import { Client } from 'pg';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function POST(req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json(mockQueryResults);
    }
    try {
        let body;
        try {
            const text = await req.text();
            console.log(`[api/query] Raw body: "${text}"`);
            body = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('[api/query] Body parsing failed:', e);
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { query } = body;
        console.log(`[api/query] Extracted query: "${query}"`);

        if (typeof query !== 'string' || !query.trim()) {
            return NextResponse.json({
                error: 'Query is empty, missing, or not a string',
                received: query,
                body: body
            }, { status: 400 });
        }

        const creds = await getClusterCredentials(namespace, name);
        const client = new Client({
            user: creds.username,
            password: creds.password,
            database: creds.dbname,
            host: creds.host,
            port: 5432,
            connectionTimeoutMillis: 10000,
        });

        await client.connect();
        const res = await client.query(query);
        await client.end();

        return NextResponse.json(res.rows);
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/query] POST failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
