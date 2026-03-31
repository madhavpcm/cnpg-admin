import { GitService } from './git';
import { listClusters as listK8sClusters, applyCluster } from './k8s';
import { SyncState, GitOpsConfig } from './types/gitops';
import { stringifyClusterYaml } from './yaml';
import * as crypto from 'crypto';

export class SyncService {
    constructor(private git: GitService) { }

    private hash(obj: any): string {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    async getSyncStatus(): Promise<SyncState> {
        const [k8sClusters, gitClusters] = await Promise.all([
            listK8sClusters(),
            this.git.listClusters()
        ]);

        const state: SyncState = {
            lastSync: new Date().toISOString(),
            lastCommitSha: '', // TODO: get from git
            status: 'synced',
            clusters: {}
        };

        const allNames = new Set([
            ...k8sClusters.map((c: any) => `${c.metadata.namespace}/${c.metadata.name}`),
            ...gitClusters.map((c: any) => `${c.metadata.namespace}/${c.metadata.name}`)
        ]);

        for (const key of allNames) {
            const [ns, name] = key.split('/');
            const local = k8sClusters.find((c: any) => c.metadata.namespace === ns && c.metadata.name === name);
            const remote = gitClusters.find((c: any) => c.metadata.namespace === ns && c.metadata.name === name);

            const localSpec = local ? { spec: local.spec, metadata: { name: local.metadata.name, namespace: local.metadata.namespace, labels: local.metadata.labels, annotations: local.metadata.annotations } } : null;
            const remoteSpec = remote ? { spec: remote.spec, metadata: { name: remote.metadata.name, namespace: remote.metadata.namespace, labels: remote.metadata.labels, annotations: remote.metadata.annotations } } : null;

            const localHash = localSpec ? this.hash(localSpec) : '';
            const remoteHash = remoteSpec ? this.hash(remoteSpec) : '';

            let status: any = 'synced';
            if (!local) status = 'remote-ahead';
            else if (!remote) status = 'local-ahead';
            else if (localHash !== remoteHash) status = 'conflict';

            if (status !== 'synced') state.status = 'pending';

            state.clusters[key] = {
                localSha: localHash,
                remoteSha: remoteHash,
                status: status,
                lastModified: local?.metadata?.creationTimestamp || new Date().toISOString()
            };
        }

        return state;
    }

    async applyFromGit(ns: string, name: string) {
        const clusters = await this.git.listClusters();
        const cluster = clusters.find(c => c.metadata.namespace === ns && c.metadata.name === name);
        if (!cluster) throw new Error(`Cluster ${name} in ${ns} not found in Git`);

        // Clean internal Git metadata before applying
        const cleanCluster = { ...cluster };
        delete cleanCluster._git;

        return applyCluster(ns, cleanCluster);
    }

    async applyAllFromGit() {
        const clusters = await this.git.listClusters();
        const results = [];
        for (const cluster of clusters) {
            const ns = cluster.metadata.namespace;
            const name = cluster.metadata.name;
            results.push(await this.applyFromGit(ns, name));
        }
        return results;
    }

    async pushToGit(ns: string, name: string, localCluster: any, message?: string) {
        const yaml = stringifyClusterYaml(localCluster);
        return this.git.pushCluster(ns, name, yaml, message);
    }

    async createPRToGit(ns: string, name: string, localCluster: any, title: string, body?: string): Promise<string> {
        const yaml = stringifyClusterYaml(localCluster);
        return this.git.createPR(ns, name, yaml, title, body);
    }
}
