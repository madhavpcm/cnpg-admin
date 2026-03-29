'use client';

import { useEffect, useState } from 'react';

type Tab = 'General' | 'GitOps' | 'Helm';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('General');
    const [repoUrl, setRepoUrl] = useState('');
    const [branch, setBranch] = useState('main');
    const [saving, setSaving] = useState(false);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const resp = await fetch('/api/gitops/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: repoUrl, branch }),
            });
            if (!resp.ok) throw new Error('Failed to connect repo');
            alert('Repository connected successfully!');
        } catch (e) {
            alert(String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page">
            <h1 className="mb-6">Settings</h1>

            <div className="flex gap-4 mb-8">
                <button
                    className={`btn ${activeTab === 'General' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('General')}
                >
                    General
                </button>
                <button
                    className={`btn ${activeTab === 'GitOps' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('GitOps')}
                >
                    GitOps
                </button>
                <button
                    className={`btn ${activeTab === 'Helm' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('Helm')}
                >
                    Helm
                </button>
            </div>

            {activeTab === 'General' ? (
                <div className="card">
                    <h2 className="mb-4">Application Configuration</h2>
                    <div className="form-group">
                        <label>Namespace</label>
                        <input type="text" defaultValue="cnpg-system" readOnly />
                    </div>
                </div>
            ) : activeTab === 'GitOps' ? (
                <div className="card max-w-2xl">
                    <h2 className="mb-4">GitOps Connection</h2>
                    <p className="text-gray-400 mb-6 text-sm">
                        Connect a GitHub repository containing your Helm values. For testing, only public repositories are supported without tokens.
                    </p>
                    <form onSubmit={handleConnect} className="space-y-4">
                        <div className="form-group">
                            <label>Repository URL</label>
                            <input
                                type="text"
                                placeholder="https://github.com/org/infra-repo"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Branch</label>
                            <input
                                type="text"
                                value={branch}
                                onChange={(e) => setBranch(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
                            {saving ? 'Connecting...' : 'Connect Repository'}
                        </button>
                    </form>
                </div>
            ) : (
                <HelmReleases />
            )}
        </div>
    );
}

function HelmReleases() {
    const [releases, setReleases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/helm/releases')
            .then(r => r.json())
            .then(data => {
                setReleases(Array.isArray(data) ? data : []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="card">Loading Helm releases...</div>;

    return (
        <div className="space-y-6">
            <h2 className="mb-4 text-xl">Detected Helm Releases</h2>
            {releases.length === 0 ? (
                <div className="card text-gray-400">No Helm releases found in the cluster.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {releases.map(r => (
                        <div key={`${r.namespace}/${r.name}`} className="card">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{r.name}</h3>
                                    <p className="text-sm text-gray-400">ns: {r.namespace}</p>
                                </div>
                                <span className={`badge ${r.status === 'deployed' ? 'badge-success' : 'badge-warning'}`}>
                                    {r.status}
                                </span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Chart</p>
                                    <p className="text-sm">{r.chart} ({r.chartVersion})</p>
                                </div>
                                <button className="btn btn-outline btn-sm">Configure GitOps</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
