export default function GitOpsPage() {
    return (
        <div className="page">
            <h1 className="mb-6">GitOps</h1>
            <div className="card">
                <h2 className="mb-4">Connected Repositories</h2>
                <p className="text-gray-400">
                    Connect a Git repository containing a <code>cnpg-clusters.yaml</code> file to manage
                    clusters declaratively. GitOps integration coming soon.
                </p>
                <div className="mt-6">
                    <button className="btn btn-primary" disabled>
                        Connect Repository
                    </button>
                </div>
            </div>
        </div>
    );
}
