'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';

interface RawCluster {
    metadata: { name: string; namespace: string };
    spec?: { instances?: number; imageName?: string };
    status?: { phase?: string; readyInstances?: number };
}

interface ClusterRow {
    name: string;
    namespace: string;
    status: string;
    instances: number;
    ready: number;
}

function parseCluster(raw: RawCluster): ClusterRow {
    return {
        name: raw.metadata.name,
        namespace: raw.metadata.namespace,
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
    const router = useRouter();

    useEffect(() => {
        Promise.all([
            fetch('/api/clusters').then((r) => r.json()),
            fetch('/api/namespaces').then((r) => r.json()),
        ])
            .then(([clustersData, namespacesData]) => {
                const items = Array.isArray(clustersData) ? clustersData : [];
                setClusters(items.map(parseCluster));
                setNamespaces(Array.isArray(namespacesData) ? namespacesData : []);
            })
            .catch((e) => setError(String(e)))
            .finally(() => {
                setTimeout(() => setLoading(false), 400);
            });
    }, []);

    const filteredClusters = selectedNamespace === 'All Namespaces'
        ? clusters
        : clusters.filter((c) => c.namespace === selectedNamespace);

    return (
        <div className="page">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1>CNPG Clusters</h1>
                    <p className="text-gray-400 mt-4">Manage your CloudNativePG database clusters</p>
                </div>
                <div className="flex gap-4">
                    <select
                        className="select"
                        value={selectedNamespace}
                        onChange={(e) => setSelectedNamespace(e.target.value)}
                        style={{ width: 'auto', minWidth: 200 }}
                    >
                        <option>All Namespaces</option>
                        {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                    </select>
                    <Link href="/clusters/new" className="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create New Cluster
                    </Link>
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
                <Loading message="Fetching clusters from Kubernetes.." />
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Namespace</th>
                            <th>Instances</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredClusters.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-3)', padding: '40px' }}>
                                    No clusters found in this namespace.
                                </td>
                            </tr>
                        )}
                        {filteredClusters.map((cl) => (
                            <tr key={`${cl.namespace}/${cl.name}`}>
                                <td>
                                    <Link
                                        href={`/clusters/${cl.namespace}/${cl.name}`}
                                        className="font-semibold text-blue-600 no-underline"
                                        style={{ textDecoration: 'none' }}
                                    >
                                        {cl.name}
                                    </Link>
                                </td>
                                <td className="text-gray-500">{cl.namespace}</td>
                                <td>
                                    <span className="font-semibold">{cl.ready}</span>
                                    <span className="text-gray-300 mx-1">/</span>
                                    <span className="text-gray-500">{cl.instances}</span>
                                </td>
                                <td>
                                    <span className={statusBadge(cl.status)}>{cl.status}</span>
                                </td>
                                <td>
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={() => router.push(`/clusters/${cl.namespace}/${cl.name}`)}
                                    >
                                        View Details
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
