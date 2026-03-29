'use client';

export default function SettingsPage() {
    return (
        <div className="page">
            <h1 className="mb-6">Settings</h1>

            <div className="card max-w-2xl">
                <h2 className="mb-4 text-xl">General Configuration</h2>
                <div className="space-y-6">
                    <div className="form-group">
                        <label className="text-gray-400">System Namespace</label>
                        <input
                            type="text"
                            className="input bg-gray-50 cursor-not-allowed"
                            defaultValue="cnpg-system"
                            readOnly
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            The primary namespace where CNPG-Admin is deployed and managed.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
                            Advanced Settings
                        </h3>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium">Debug Logging</p>
                                <p className="text-sm text-gray-500">Enable verbose logging for Kubernetes API calls.</p>
                            </div>
                            <button className="btn btn-outline btn-sm" disabled>Disabled</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-12 p-6 border border-dashed border-gray-200 rounded-xl text-center">
                <p className="text-sm text-gray-500">
                    Looking for GitOps or Helm configurations?
                </p>
                <a href="/gitops" className="text-primary font-semibold hover:underline mt-1 inline-block">
                    Go to GitOps Central →
                </a>
            </div>
        </div>
    );
}
