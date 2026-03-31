'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';
import { SyncBadge } from '@/components/gitops/SyncBadge';
import { GitOpsConfig, SyncState } from '@/lib/types/gitops';

interface RawCluster {
    metadata: { name: string; namespace: string; labels?: any; annotations?: any; creationTimestamp?: string };
    spec?: { instances?: number; imageName?: string };
    status?: { phase?: string; readyInstances?: number };
}

interface ClusterRow {
    name: string;
    namespace: string;
    status: string;
    instances: number;
    ready: number;
    syncStatus?: SyncState['clusters'][string]['status'];
}

function parseCluster(raw: RawCluster): ClusterRow {
    return {
        name: raw.metadata?.name ?? 'Unknown',
        namespace: raw.metadata?.namespace ?? 'Unknown',
        status: raw.status?.phase ?? 'Unknown',
        instances: raw.spec?.instances ?? 0,
        ready: raw.status?.readyInstances ?? 0,
    };
}

function statusBadge(status: string) {
    if (status === 'Cluster in healthy state') return 'badge badge-success';
    if (status === 'Unhealthy') return 'badge badge-warning';
    return 'badge badge-info';
}

export default function ClustersPage() {
    const [clusters, setClusters] = useState<ClusterRow[]>([]);
    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState('All Namespaces');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [gitOpsConfig, setGitOpsConfig] = useState<GitOpsConfig | null>(null);
    const [syncState, setSyncState] = useState<SyncState | null>(null);
    const router = useRouter();

    useEffect(() => {
        setLoading(true);
        const nsParam = selectedNamespace === 'All Namespaces' ? '' : `?namespace=${selectedNamespace}`;

        Promise.all([
            fetch(`/api/clusters${nsParam}`).then((r) => r.json()),
            fetch('/api/namespaces').then((r) => r.json()),
            fetch('/api/gitops/config').then((r) => r.json()),
        ])
            .then(([clustersData, namespacesData, configData]) => {
                const items = Array.isArray(clustersData) ? clustersData : [];
                setNamespaces(Array.isArray(namespacesData) ? namespacesData : []);

                if (configData && configData.enabled) {
                    setGitOpsConfig(configData);
                    fetch('/api/gitops/drift')
                        .then(r => r.json())
                        .then(driftData => {
                            setSyncState(driftData);
                            setClusters(items.map(raw => {
                                const row = parseCluster(raw);
                                const key = `${row.namespace}/${row.name}`;
                                if (driftData?.clusters?.[key]) {
                                    row.syncStatus = driftData.clusters[key].status;
                                }
                                return row;
                            }));
                        })
                        .catch(err => {
                            console.error('Failed to fetch drift:', err);
                            setClusters(items.map(parseCluster));
                        });
                } else {
                    setClusters(items.map(parseCluster));
                }
            })
            .catch((e) => setError(String(e)))
            .finally(() => {
                setTimeout(() => setLoading(false), 400);
            });
    }, [selectedNamespace]);

    const refreshSync = () => {
        fetch('/api/gitops/drift')
            .then(r => r.json())
            .then(driftData => {
                setSyncState(driftData);
                setClusters(prev => prev.map(row => {
                    const key = `${row.namespace}/${row.name}`;
                    return {
                        ...row,
                        syncStatus: driftData?.clusters?.[key]?.status || row.syncStatus
                    };
                }));
            });
    };

    if (loading && clusters.length === 0) return <Loading message="Fetching Clusters.." />;

    return (
        <div className="page">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1>CNPG Clusters</h1>
                    <p className="text-gray-400 mt-4">Manage your CloudNativePG database clusters</p>
                </div>
                <div className="flex gap-4">
                    <select
                        style={{ width: 'auto', minWidth: '180px' }}
                        value={selectedNamespace}
                        onChange={(e) => setSelectedNamespace(e.target.value)}
                    >
                        <option>All Namespaces</option>
                        {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                    </select>
                    <Link href="/clusters/new" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Cluster
                    </Link>
                </div>
            </div>

            {error && <div className="alert alert-error mb-6">{error}</div>}

            {loading && clusters.length > 0 ? (
                <Loading message="Refreshing latest state..." />
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Namespace</th>
                            <th>Instances</th>
                            <th>Status</th>
                            {gitOpsConfig?.enabled && <th>Git Sync</th>}
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clusters.length === 0 && (
                            <tr>
                                <td colSpan={gitOpsConfig?.enabled ? 6 : 5} style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-3)' }}>
                                    No clusters found in this namespace.
                                </td>
                            </tr>
                        )}
                        {clusters.map((cl) => (
                            <tr key={`${cl.namespace}/${cl.name}`}>
                                <td>
                                    <Link
                                        href={`/clusters/${cl.namespace}/${cl.name}`}
                                        className="font-bold no-underline text-blue-600"
                                    >
                                        {cl.name}
                                    </Link>
                                </td>
                                <td className="text-gray-500">{cl.namespace}</td>
                                <td>
                                    <span className="font-bold" style={{ color: 'var(--cnp-purple)' }}>{cl.ready}</span>
                                    <span className="text-gray-300 mx-1">/</span>
                                    <span className="text-gray-500">{cl.instances}</span>
                                </td>
                                <td>
                                    <span className={statusBadge(cl.status)}>{cl.status}</span>
                                </td>
                                {gitOpsConfig?.enabled && (
                                    <td>
                                        <SyncBadge
                                            status={cl.syncStatus || 'unknown'}
                                            namespace={cl.namespace}
                                            name={cl.name}
                                            onSync={refreshSync}
                                        />
                                    </td>
                                )}
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={() => router.push(`/clusters/${cl.namespace}/${cl.name}`)}
                                    >
                                        Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
