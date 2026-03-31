'use client';

import React, { useEffect, useState } from 'react';
import { GitOpsSettings } from '@/components/gitops/GitOpsSettings';
import { DriftTable } from '@/components/gitops/DriftTable';
import { Loading } from '@/components/Loading';
import { GitOpsConfig, SyncState } from '@/lib/types/gitops';

export default function GitOpsPage() {
    const [config, setConfig] = useState<GitOpsConfig | null>(null);
    const [syncState, setSyncState] = useState<SyncState | null>(null);
    const [loading, setLoading] = useState(true);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [configRes, syncRes] = await Promise.all([
                fetch('/api/gitops/config'),
                fetch('/api/gitops/drift')
            ]);

            if (configRes.ok) setConfig(await configRes.json());
            if (syncRes.ok) setSyncState(await syncRes.json());
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleApplyAll = async () => {
        if (!confirm('Apply all configurations from Git to Kubernetes? This will reconcile all drifted clusters.')) return;
        setBulkLoading(true);
        try {
            const res = await fetch('/api/gitops/apply-all', { method: 'POST' });
            if (res.ok) {
                alert('Apply All triggered successfully');
                fetchData();
            }
        } catch (err) {
            alert('Apply All failed: ' + err);
        } finally {
            setBulkLoading(false);
        }
    };

    const handlePushAll = async () => {
        if (!confirm('Push all configurations from Kubernetes to Git? This will overwrite Git content for all clusters.')) return;
        setBulkLoading(true);
        try {
            const res = await fetch('/api/gitops/push-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Bulk push from GitOps Dashboard' })
            });
            if (res.ok) {
                alert('Push All triggered successfully');
                fetchData();
            }
        } catch (err) {
            alert('Push All failed: ' + err);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleCheckDrift = async () => {
        setBulkLoading(true);
        try {
            const res = await fetch('/api/gitops/drift', { method: 'POST' });
            if (res.ok) {
                fetchData();
            } else {
                alert('Failed to trigger drift reconciliation.');
            }
        } catch (err) {
            alert('Reconciliation failed: ' + err);
        } finally {
            setBulkLoading(false);
        }
    };

    if (loading) return <Loading message="Loading GitOps Dashboard.." />;

    return (
        <div className="page">
            <div className="flex justify-between items-center mb-10 pb-8 border-b">
                <div>
                    <h1>GitOps Control Center</h1>
                    <p className="text-gray-400 mt-4">
                        Manage infrastructure as code and monitor cluster synchronization drift.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleCheckDrift}
                        disabled={bulkLoading || !config?.repoUrl}
                        className="btn btn-secondary shadow-sm"
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {bulkLoading ? 'Working..' : 'Check Drift Now'}
                    </button>
                    <button
                        onClick={handleApplyAll}
                        disabled={bulkLoading || !config?.repoUrl}
                        className="btn btn-secondary shadow-sm"
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {bulkLoading ? 'Working..' : 'Apply All from Git'}
                    </button>
                    <button
                        onClick={handlePushAll}
                        disabled={bulkLoading || !config?.repoUrl}
                        className="btn btn-primary shadow-sm"
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {bulkLoading ? 'Working..' : 'Push All to Git'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-error mb-10">
                    <span>Error: {error}</span>
                </div>
            )}

            <section className="mb-10">
                <GitOpsSettings config={config} onUpdate={fetchData} />
            </section>

            {config?.repoUrl && (
                <section className="mt-12">
                    <DriftTable syncState={syncState} onRefresh={fetchData} />
                </section>
            )}

            {!config?.repoUrl && (
                <div className="card" style={{ padding: '60px', textAlign: 'center', borderStyle: 'dashed', background: 'transparent' }}>
                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <svg className="mb-4 mx-auto" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-3)" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <h3 className="mb-2">GitOps is Disabled</h3>
                        <p className="text-gray-500">
                            Enable GitOps to start managing your clusters with infrastructure as code.
                            Connect a repository to track configuration drift and automate deployments.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
