// components/gitops/SyncBadge.tsx

import React, { useState } from 'react';

interface SyncBadgeProps {
    status: 'synced' | 'local-ahead' | 'remote-ahead' | 'conflict' | 'pending' | 'error' | 'unknown';
    namespace?: string;
    name?: string;
    onSync?: () => void;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({ status, namespace, name, onSync }) => {
    const [loading, setLoading] = useState(false);

    const handleApply = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!namespace || !name) return;
        setLoading(true);
        try {
            const res = await fetch('/api/gitops/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ namespace, name }),
            });
            if (res.ok && onSync) onSync();
        } catch (err) {
            console.error('Failed to apply:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePush = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!namespace || !name) return;
        setLoading(true);
        try {
            const res = await fetch('/api/gitops/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ namespace, name }),
            });
            if (res.ok && onSync) onSync();
        } catch (err) {
            console.error('Failed to push:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStyles = () => {
        switch (status) {
            case 'synced': return 'badge-success';
            case 'local-ahead': return 'badge-info';
            case 'remote-ahead': return 'badge-warning';
            case 'conflict': return 'badge-error';
            case 'pending': return 'badge-warning';
            case 'error': return 'badge-error';
            default: return '';
        }
    };

    const getLabel = () => {
        switch (status) {
            case 'synced': return 'Synced';
            case 'local-ahead': return 'Local Ahead';
            case 'remote-ahead': return 'Remote Ahead';
            case 'conflict': return 'Conflict';
            case 'pending': return 'Pending';
            case 'error': return 'Error';
            default: return 'Unknown';
        }
    };

    const showApply = status === 'remote-ahead' || status === 'conflict';
    const showPush = status === 'local-ahead' || status === 'conflict';

    return (
        <div className="flex items-center gap-2">
            <span className={`badge ${getStyles()} uppercase tracking-wider`} style={{ fontSize: '10px' }}>
                {getLabel()}
            </span>
            {showApply && (
                <button
                    onClick={handleApply}
                    disabled={loading}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '10px', height: '22px' }}
                >
                    {loading ? '...' : 'Apply'}
                </button>
            )}
            {showPush && (
                <button
                    onClick={handlePush}
                    disabled={loading}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '10px', height: '22px' }}
                >
                    {loading ? '...' : 'Push'}
                </button>
            )}
        </div>
    );
};
