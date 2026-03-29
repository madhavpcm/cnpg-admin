'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewClusterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [pgVersion, setPgVersion] = useState('16');
    const [instances, setInstances] = useState(3);
    const [storage, setStorage] = useState('10Gi');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) { setError('Cluster name is required'); return; }
        setSubmitting(true);
        setError('');

        const body = {
            apiVersion: 'postgresql.cnpg.io/v1',
            kind: 'Cluster',
            metadata: { name },
            spec: {
                instances,
                storage: { size: storage },
                imageName: `ghcr.io/cloudnative-pg/postgresql:${pgVersion}`,
            },
        };

        try {
            const resp = await fetch('/api/clusters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            router.push('/clusters');
        } catch (e) {
            setError(String(e));
            setSubmitting(false);
        }
    };

    return (
        <div className="page">
            <h1 className="mb-10">Create New Database Cluster</h1>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="card" style={{ maxWidth: 680 }}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="cluster-name">Cluster Name</label>
                        <input
                            id="cluster-name"
                            type="text"
                            placeholder="e.g. prod-db"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-2">
                        <div className="form-group">
                            <label htmlFor="pg-version">PostgreSQL Version</label>
                            <select
                                id="pg-version"
                                value={pgVersion}
                                onChange={(e) => setPgVersion(e.target.value)}
                            >
                                <option value="16">PostgreSQL 16 (Latest)</option>
                                <option value="15">PostgreSQL 15</option>
                                <option value="14">PostgreSQL 14</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="instances">Instances (Redundancy)</label>
                            <input
                                id="instances"
                                type="number"
                                min={1}
                                max={9}
                                value={instances}
                                onChange={(e) => setInstances(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="storage">Storage Size</label>
                        <input
                            id="storage"
                            type="text"
                            placeholder="e.g. 10Gi"
                            value={storage}
                            onChange={(e) => setStorage(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push('/clusters')}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Provisioning…' : 'Provision Cluster'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
