'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'Overview' | 'Users' | 'Query' | 'Tables' | 'Metrics' | 'Logs';

interface RawCluster {
    metadata?: { name?: string; namespace?: string };
    spec?: {
        instances?: number;
        imageName?: string;
        storage?: { size?: string };
        resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } };
    };
    status?: { phase?: string; readyInstances?: number };
}

interface User { username: string; role: string; created_at: string; }
interface QueryRow { [key: string]: unknown; }

const TABS: { name: Tab; iconPath: string }[] = [
    { name: 'Overview', iconPath: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { name: 'Users', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    { name: 'Query', iconPath: 'M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z' },
    { name: 'Tables', iconPath: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18' },
    { name: 'Metrics', iconPath: 'M18 20V10 M12 20V4 M6 20v-6' },
    { name: 'Logs', iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
];

export default function ClusterDetailPage({
    params,
}: {
    params: Promise<{ namespace: string; name: string }>;
}) {
    const { namespace, name } = use(params);
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('Overview');
    const [cluster, setCluster] = useState<RawCluster | null>(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [queryText, setQueryText] = useState('');
    const [queryResults, setQueryResults] = useState<QueryRow[]>([]);

    useEffect(() => {
        const base = `/api/clusters/${namespace}/${name}`;
        Promise.all([
            fetch(base).then((r) => r.json()),
            fetch(`${base}/logs`).then((r) => r.text()),
            fetch(`${base}/users`).then((r) => r.json()),
            fetch(`${base}/tables`).then((r) => r.json()),
        ])
            .then(([c, l, u, t]) => {
                setCluster(c);
                setLogs(l);
                setUsers(u);
                setTables(t);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [namespace, name]);

    const runQuery = async () => {
        const resp = await fetch(`/api/clusters/${namespace}/${name}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryText }),
        });
        const results = await resp.json();
        setQueryResults(results);
    };

    if (loading) return <div className="page"><p className="loading-text">Loading cluster…</p></div>;
    if (!cluster) return <div className="page"><p className="alert alert-error">Cluster not found.</p></div>;

    return (
        <div className="page">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button className="btn btn-outline btn-sm" onClick={() => router.push('/clusters')}>
                    ← Back
                </button>
                <h1>{name}</h1>
                <span className={`badge ${cluster.status?.phase === 'Cluster in healthy state' ? 'badge-success' : 'badge-warning'}`}>
                    {cluster.status?.phase ?? 'Unknown'}
                </span>
                <span className="text-gray-400 text-sm">ns: {namespace}</span>
            </div>

            <div className="flex gap-6">
                {/* Sub-nav */}
                <div className="sub-nav">
                    {TABS.map((tab) => (
                        <button
                            key={tab.name}
                            className={`sub-nav-btn${activeTab === tab.name ? ' active' : ''}`}
                            onClick={() => setActiveTab(tab.name)}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {tab.iconPath.split(' M').map((d, i) => (
                                    <path key={i} d={i === 0 ? d : 'M' + d} />
                                ))}
                            </svg>
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1">
                    {activeTab === 'Overview' && <OverviewTab cluster={cluster} />}
                    {activeTab === 'Users' && <UsersTab users={users} />}
                    {activeTab === 'Query' && (
                        <QueryTab
                            queryText={queryText}
                            setQueryText={setQueryText}
                            queryResults={queryResults}
                            onRun={runQuery}
                        />
                    )}
                    {activeTab === 'Tables' && <TablesTab tables={tables} />}
                    {activeTab === 'Metrics' && <MetricsTab />}
                    {activeTab === 'Logs' && <LogsTab logs={logs} />}
                </div>
            </div>
        </div>
    );
}

/* ---- Sub-tab components ---- */

function OverviewTab({ cluster }: { cluster: RawCluster }) {
    const spec = cluster.spec ?? {};
    const status = cluster.status ?? {};
    const req = spec.resources?.requests ?? {};
    return (
        <div className="grid grid-2">
            <div className="card">
                <h2 className="mb-4">Infrastructure</h2>
                <div className="form-group"><label>Image</label><p className="text-sm">{spec.imageName ?? '—'}</p></div>
                <div className="form-group"><label>CPU (requests)</label><p>{req.cpu ?? '—'}</p></div>
                <div className="form-group"><label>Memory (requests)</label><p>{req.memory ?? '—'}</p></div>
                <div className="form-group"><label>Storage</label><p>{spec.storage?.size ?? '—'}</p></div>
            </div>
            <div className="card">
                <h2 className="mb-4">Health</h2>
                <div className="form-group">
                    <label>Status</label>
                    <span className={`badge ${status.phase === 'Cluster in healthy state' ? 'badge-success' : 'badge-warning'}`}>
                        {status.phase ?? 'Unknown'}
                    </span>
                </div>
                <div className="form-group">
                    <label>Instances Ready</label>
                    <p className="text-2xl font-bold">{status.readyInstances ?? 0} / {spec.instances ?? 0}</p>
                </div>
            </div>
        </div>
    );
}

function UsersTab({ users }: { users: User[] }) {
    return (
        <div className="card">
            <div className="flex justify-between items-center mb-6">
                <h2>Database Users</h2>
                <button className="btn btn-primary">Add User</button>
            </div>
            <table>
                <thead><tr><th>Username</th><th>Role</th><th>Created</th></tr></thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.username}>
                            <td className="font-semibold">{u.username}</td>
                            <td><span className="badge badge-info">{u.role}</span></td>
                            <td className="text-gray-500 text-sm">{u.created_at}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function QueryTab({
    queryText, setQueryText, queryResults, onRun,
}: {
    queryText: string;
    setQueryText: (v: string) => void;
    queryResults: QueryRow[];
    onRun: () => void;
}) {
    const cols = queryResults.length > 0 ? Object.keys(queryResults[0]) : [];
    return (
        <div className="card">
            <h2 className="mb-4">Query Executor</h2>
            <textarea
                className="query-editor w-full h-40"
                placeholder="SELECT * FROM users;"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
            />
            <button className="btn btn-primary mt-4" onClick={onRun}>Run Query</button>
            {queryResults.length > 0 && (
                <div className="mt-8 overflow-auto">
                    <h3 className="mb-4">Results ({queryResults.length} rows)</h3>
                    <table>
                        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                        <tbody>
                            {queryResults.map((row, i) => (
                                <tr key={i}>
                                    {cols.map((c) => <td key={c}>{String(row[c])}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function TablesTab({ tables }: { tables: string[] }) {
    return (
        <div className="card">
            <h2 className="mb-4">Tables</h2>
            <ul className="list-none p-0">
                {tables.map((t) => (
                    <li key={t} className="p-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="font-semibold">{t}</span>
                        <button className="btn btn-outline btn-sm">Preview</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function MetricsTab() {
    return (
        <div className="grid grid-2">
            <div className="card">
                <h2 className="mb-4">Throughput</h2>
                <div className="stat-value">245 req/s</div>
                <p className="text-sm text-gray-400 mt-4">Requests per second</p>
            </div>
            <div className="card">
                <h2 className="mb-4">Latency</h2>
                <div className="stat-value">12ms</div>
                <p className="text-sm text-gray-400 mt-4">Average response time</p>
            </div>
        </div>
    );
}

function LogsTab({ logs }: { logs: string }) {
    return (
        <div className="card">
            <h2 className="mb-4">Logs</h2>
            <pre className="query-editor h-96">{logs || 'No logs available.'}</pre>
        </div>
    );
}
