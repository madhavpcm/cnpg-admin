import { NextResponse } from 'next/server';
import { isMock, mockTables, getClusterCredentials } from '@/lib/k8s';
import { Client } from 'pg';

interface Params {
    params: Promise<{ namespace: string; name: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    const { namespace, name } = await params;
    if (isMock) {
        return NextResponse.json(mockTables);
    }
    try {
        const creds = await getClusterCredentials(namespace, name);
        const client = new Client({
            user: creds.username,
            password: creds.password,
            database: creds.dbname,
            host: creds.host,
            port: 5432,
            connectionTimeoutMillis: 5000,
        });

        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        await client.end();

        const tables = res.rows.map(row => row.table_name);
        return NextResponse.json(tables);
    } catch (e) {
        console.error(`[/api/clusters/${namespace}/${name}/tables] GET failed:`, e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
