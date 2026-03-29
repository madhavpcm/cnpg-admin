export default function SettingsPage() {
    return (
        <div className="page">
            <h1 className="mb-6">Settings</h1>
            <div className="card">
                <h2 className="mb-4">Application Configuration</h2>
                <div className="form-group">
                    <label>Namespace</label>
                    <input type="text" defaultValue="cnpg-system" readOnly />
                </div>
                <div className="form-group">
                    <label>Mock Mode</label>
                    <p className="text-sm text-gray-400">
                        Set <code>MOCK=true</code> environment variable to enable mock data (no Kubernetes
                        required).
                    </p>
                </div>
            </div>
        </div>
    );
}
