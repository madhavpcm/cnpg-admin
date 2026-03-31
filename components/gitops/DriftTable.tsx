// components/gitops/DriftTable.tsx

import React from 'react';
import { SyncState } from '@/lib/types/gitops';
import { SyncBadge } from './SyncBadge';

interface DriftTableProps {
    syncState: SyncState | null;
    onRefresh: () => void;
}

export const DriftTable: React.FC<DriftTableProps> = ({ syncState, onRefresh }) => {
    if (!syncState) return null;

    const clusterKeys = Object.keys(syncState.clusters || {});

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex justify-between items-center px-6 py-4 border-b">
                <h2>Drift Summary</h2>
                <button
                    onClick={onRefresh}
                    className="btn btn-outline btn-sm"
                >
                    Refresh Drift
                </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                    <thead>
                        <tr>
                            <th style={{ background: '#f8fafc' }}>Cluster Path</th>
                            <th style={{ background: '#f8fafc' }}>Status</th>
                            <th style={{ background: '#f8fafc' }}>Last Checked</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clusterKeys.length === 0 ? (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-3)' }}>
                                    No clusters discovered in Git or Kubernetes.
                                </td>
                            </tr>
                        ) : (
                            clusterKeys.map(key => {
                                const cluster = syncState.clusters[key];
                                const [namespace, name] = key.split('/');
                                return (
                                    <tr key={key}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{key}</td>
                                        <td>
                                            <SyncBadge
                                                status={cluster.status}
                                                namespace={namespace}
                                                name={name}
                                                onSync={onRefresh}
                                            />
                                        </td>
                                        <td className="text-gray-400 text-xs">
                                            {new Date(cluster.lastModified).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-4 border-t text-xs text-gray-500" style={{ background: '#f8fafc' }}>
                Last sync check: {new Date(syncState.lastSync).toLocaleString()}
            </div>
        </div>
    );
};
