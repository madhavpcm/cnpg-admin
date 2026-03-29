'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RawCluster {
    metadata: { name: string; namespace: string };
    spec?: { instances?: number; imageName?: string; storage?: { size?: string } };
    status?: { phase?: string; readyInstances?: number };
}

interface Stats {
    total: number;
    healthy: number;
    instances: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats>({ total: 0, healthy: 0, instances: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/clusters')
            .then((r) => r.json())
            .then((clusters: RawCluster[]) => {
                let healthy = 0;
                let instances = 0;
                for (const c of clusters) {
                    if (c.status?.phase === 'Cluster in healthy state') healthy++;
                    instances += c.spec?.instances ?? 0;
                }
                setStats({ total: clusters.length, healthy, instances });
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="page">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1>Overview</h1>
                    <p className="text-gray-400 mt-4">CloudNativePG cluster summary</p>
                </div>
                <Link href="/clusters/new" className="btn btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Cluster
                </Link>
            </div>

            {loading ? (
                <p className="loading-text">Loading cluster data…</p>
            ) : (
                <div className="grid grid-3">
                    <StatCard
                        label="Total Clusters"
                        value={stats.total}
                        color="#3b82f6"
                        icon="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z M3.27 6.96 12 12.01 20.73 6.96 M12 22.08V12"
                    />
                    <StatCard
                        label="Healthy Clusters"
                        value={stats.healthy}
                        color="#10b981"
                        icon="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01 9 11.01"
                    />
                    <StatCard
                        label="Total Instances"
                        value={stats.instances}
                        color="#8b5cf6"
                        icon="M2 2h20v8H2z M2 14h20v8H2z M6 6h.01 M6 18h.01"
                    />
                </div>
            )}

            <div className="mt-8">
                <div className="card">
                    <h2 className="mb-4">Quick Actions</h2>
                    <div className="flex gap-4">
                        <Link href="/clusters" className="btn btn-outline">View All Clusters</Link>
                        <Link href="/clusters/new" className="btn btn-primary">Create Cluster</Link>
                        <Link href="/gitops" className="btn btn-outline">GitOps</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
    return (
        <div className="card stat-card">
            <div className="flex items-center gap-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {icon.split(' M').map((d, i) => (
                        <path key={i} d={i === 0 ? d : 'M' + d} />
                    ))}
                </svg>
                <div>
                    <div className="stat-value">{value}</div>
                    <div className="stat-label">{label}</div>
                </div>
            </div>
        </div>
    );
}
