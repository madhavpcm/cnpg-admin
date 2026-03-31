// lib/types/gitops.ts

export interface GitOpsConfig {
    enabled: boolean;
    repoUrl: string;
    branch: string;
    path: string;
    k8sClusterName?: string;
}

export interface SyncState {
    lastSync: string;        // ISO timestamp
    lastCommitSha: string;
    status: 'synced' | 'pending' | 'conflict' | 'error';
    clusters: {
        [key: string]: {       // key = namespace/cluster-name
            localSha: string;    // hash of local spec
            remoteSha: string;   // hash of git spec
            status: 'synced' | 'local-ahead' | 'remote-ahead' | 'conflict';
            lastModified: string;
        };
    };
}
