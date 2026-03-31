// components/gitops/GitOpsSettings.tsx

import React, { useState, useEffect } from 'react';
import { GitOpsConfig } from '@/lib/types/gitops';

interface GitOpsSettingsProps {
    config: GitOpsConfig | null;
    onUpdate: () => void;
}

export const GitOpsSettings: React.FC<GitOpsSettingsProps> = ({ config, onUpdate }) => {
    const [enabled, setEnabled] = useState(config?.enabled ?? false);
    const [repoUrl, setRepoUrl] = useState(config?.repoUrl ?? '');
    const [branch, setBranch] = useState(config?.branch ?? 'main');
    const [path, setPath] = useState(config?.path ?? 'clusters');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<'none' | 'loading' | 'success' | 'error'>('none');
    const [testError, setTestError] = useState('');

    useEffect(() => {
        if (config) {
            setEnabled(config.enabled);
            setRepoUrl(config.repoUrl || '');
            setBranch(config.branch || 'main');
            setPath(config.path || 'clusters');
        }
    }, [config]);

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/gitops/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled, repoUrl, branch, path }),
            });
            if (res.ok) onUpdate();
        } catch (err) {
            console.error('Failed to save config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToken = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/gitops/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            if (res.ok) {
                setToken('');
                alert('Token saved successfully');
            }
        } catch (err) {
            console.error('Failed to save token:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTestConnection = async () => {
        setTestStatus('loading');
        try {
            const res = await fetch('/api/gitops/test');
            const data = await res.json();
            if (data.success) {
                setTestStatus('success');
            } else {
                setTestStatus('error');
                setTestError(data.error || 'Connection failed');
            }
        } catch (err) {
            setTestStatus('error');
            setTestError(String(err));
        }
    };

    return (
        <div className="space-y-8">
            <div className="card">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Repository Configuration</h2>
                    <div className="flex items-center gap-4">
                        {config?.enabled && config?.repoUrl && (
                            <div className="badge badge-success" style={{ gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#166534' }}></div>
                                <span>Connected: {config.repoUrl.replace(/https?:\/\//, '')}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">GitOps Enabled</span>
                            <input
                                type="checkbox"
                                style={{ width: '40px', height: '20px', padding: 0 }}
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-2">
                    <div className="form-group">
                        <label>Repository URL</label>
                        <input
                            type="text"
                            placeholder="https://github.com/owner/repo"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Branch</label>
                        <input
                            type="text"
                            placeholder="main"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Cluster YAML Path</label>
                        <input
                            type="text"
                            placeholder="clusters"
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                        />
                    </div>
                    <div className="flex items-end mb-5">
                        <button
                            onClick={handleSaveConfig}
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            {loading ? 'Saving..' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <h2 className="text-lg font-bold mb-4">Authentication</h2>
                    <div className="form-group">
                        <label>GitHub Personal Access Token</label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                placeholder="ghp_********************"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            />
                            <button
                                onClick={handleSaveToken}
                                disabled={loading || !token}
                                className="btn btn-outline"
                                style={{ flexShrink: 0 }}
                            >
                                Save
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Token must have <code>repo</code> permissions.</p>
                    </div>
                </div>

                <div className="card">
                    <h2 className="text-lg font-bold mb-4">Connectivity Test</h2>
                    <div className="flex flex-col gap-4">
                        <button
                            onClick={handleTestConnection}
                            disabled={testStatus === 'loading' || !repoUrl}
                            className={`btn ${testStatus === 'success' ? 'btn-secondary' : testStatus === 'error' ? 'btn-outline' : 'btn-outline'}`}
                        >
                            {testStatus === 'loading' ? 'Testing..' : 'Test Connection'}
                        </button>

                        {testStatus === 'success' && (
                            <div className="alert alert-info" style={{ background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }}>
                                <span>Successfully connected to repository!</span>
                            </div>
                        )}

                        {testStatus === 'error' && (
                            <div className="alert alert-error">
                                <span>{testError}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
