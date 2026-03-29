'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';

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
    const [pods, setPods] = useState<any[]>([]);
    const [selectedPod, setSelectedPod] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [queryText, setQueryText] = useState('');
    const [queryResults, setQueryResults] = useState<QueryRow[]>([]);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [queryLoading, setQueryLoading] = useState(false);

    useEffect(() => {
        const base = `/api/clusters/${namespace}/${name}`;
        Promise.all([
            fetch(base).then((r) => r.json()),
            fetch(`${base}/pods`).then((r) => r.json()),
            fetch(`${base}/users`).then((r) => r.json()),
            fetch(`${base}/tables`).then((r) => r.json()),
        ])
            .then(([c, p, u, t]) => {
                setCluster(c);
                setPods(p);
                setUsers(u);
                setTables(t);
                if (p && p.length > 0) {
                    const firstPod = p[0].metadata?.name;
                    setSelectedPod(firstPod);
                    fetchLogs(firstPod);
                }
            })
            .catch(console.error)
            .finally(() => {
                setTimeout(() => setLoading(false), 400);
            });
    }, [namespace, name]);

    const fetchLogs = async (pod: string) => {
        try {
            const resp = await fetch(`/api/clusters/${namespace}/${name}/logs?pod=${pod}`);
            const text = await resp.text();
            setLogs(text);
        } catch (e) {
            console.error('Failed to fetch logs:', e);
        }
    };

    const runQuery = async () => {
        if (!queryText.trim()) {
            setQueryError('Please enter a query.');
            return;
        }
        setQueryLoading(true);
        setQueryError(null);
        try {
            const resp = await fetch(`/api/clusters/${namespace}/${name}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryText }),
            });
            const results = await resp.json();
            if (!resp.ok) {
                setQueryError(results.error || 'Query failed');
                setQueryResults([]);
            } else {
                setQueryResults(results);
                setQueryError(null);
            }
        } catch (e) {
            setQueryError(String(e));
        } finally {
            setQueryLoading(false);
        }
    };

    if (loading) return <div className="page"><Loading message={`Loading cluster ${name}..`} /></div>;
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
                    {activeTab === 'Users' && (
                        <UsersTab
                            namespace={namespace}
                            name={name}
                            users={users}
                            onRefresh={() => {
                                fetch(`/api/clusters/${namespace}/${name}/users`)
                                    .then(r => r.json())
                                    .then(setUsers);
                            }}
                        />
                    )}
                    {activeTab === 'Query' && (
                        <QueryTab
                            queryText={queryText}
                            setQueryText={setQueryText}
                            queryResults={queryResults}
                            queryError={queryError}
                            queryLoading={queryLoading}
                            onRun={runQuery}
                        />
                    )}
                    {activeTab === 'Tables' && <TablesTab tables={tables} />}
                    {activeTab === 'Metrics' && <MetricsTab />}
                    {activeTab === 'Logs' && (
                        <LogsTab
                            logs={logs}
                            pods={pods}
                            selectedPod={selectedPod}
                            onPodChange={(p) => {
                                setSelectedPod(p);
                                fetchLogs(p);
                            }}
                        />
                    )}
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

function UsersTab({ namespace, name, users, onRefresh }: { namespace: string, name: string, users: User[], onRefresh: () => void }) {
    const [editingUsername, setEditingUsername] = useState<string | null>(null);
    const [editLogin, setEditLogin] = useState(false);
    const [editSuperuser, setEditSuperuser] = useState(false);
    const [saving, setSaving] = useState(false);

    const startEdit = (u: User) => {
        setEditingUsername(u.username);
        setEditLogin(u.role !== 'nologin');
        setEditSuperuser(u.role === 'superuser');
    };

    const handleSave = async (username: string) => {
        setSaving(true);
        try {
            const resp = await fetch(`/api/clusters/${namespace}/${name}/users/${username}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: editLogin, superuser: editSuperuser }),
            });
            if (!resp.ok) throw new Error('Update failed');
            setEditingUsername(null);
            onRefresh();
        } catch (e) {
            alert(String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card">
            <div className="flex justify-between items-center mb-6">
                <h2>Database Users</h2>
                <button className="btn btn-primary">Add User</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Permissions</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.username}>
                            <td className="font-semibold">{u.username}</td>
                            <td>
                                {editingUsername === u.username ? (
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input type="checkbox" checked={editLogin} onChange={e => setEditLogin(e.target.checked)} /> Login
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input type="checkbox" checked={editSuperuser} onChange={e => setEditSuperuser(e.target.checked)} /> Superuser
                                        </label>
                                    </div>
                                ) : (
                                    <span className={`badge ${u.role === 'superuser' ? 'badge-success' : 'badge-info'}`}>{u.role}</span>
                                )}
                            </td>
                            <td className="text-gray-400 text-xs">
                                {u.role === 'superuser' ? 'All Privileges' : (u.role === 'login' ? 'Standard Access' : 'No Login')}
                            </td>
                            <td className="text-gray-500 text-sm">{u.created_at}</td>
                            <td>
                                {editingUsername === u.username ? (
                                    <div className="flex gap-2">
                                        <button className="btn btn-primary btn-sm" onClick={() => handleSave(u.username)} disabled={saving}>
                                            {saving ? '...' : 'Save'}
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={() => setEditingUsername(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <button className="btn btn-outline btn-sm" onClick={() => startEdit(u)}>Edit</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function QueryTab({
    queryText, setQueryText, queryResults, queryError, queryLoading, onRun,
}: {
    queryText: string;
    setQueryText: (v: string) => void;
    queryResults: QueryRow[];
    queryError: string | null;
    queryLoading: boolean;
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
                disabled={queryLoading}
            />

            {queryError && <div className="alert alert-error mt-4">{queryError}</div>}

            <button
                className={`btn btn-primary mt-4${queryLoading ? ' loading' : ''}`}
                onClick={onRun}
                disabled={queryLoading}
            >
                {queryLoading ? 'Running...' : 'Run Query'}
            </button>
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

function LogsTab({
    logs,
    pods,
    selectedPod,
    onPodChange
}: {
    logs: string;
    pods: any[];
    selectedPod: string | null;
    onPodChange: (pod: string) => void;
}) {
    return (
        <div className="card">
            <div className="flex justify-between items-center mb-4">
                <h2>Logs</h2>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Pod:</label>
                    <select
                        className="select select-sm"
                        value={selectedPod || ''}
                        onChange={(e) => onPodChange(e.target.value)}
                    >
                        {pods.map((p) => (
                            <option key={p.metadata?.name} value={p.metadata?.name}>
                                {p.metadata?.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <pre className="query-editor h-96">{logs || 'No logs available.'}</pre>
        </div>
    );
}
