import { V1ObjectMeta } from '@kubernetes/client-node';
import { listReleases } from './helm';

export enum GitOpsStatus {
    NOT_GITOPS = 'NOT_GITOPS',
    HELM_UNCONNECTED = 'HELM_UNCONNECTED',
    HELM_GITOPS = 'HELM_GITOPS',
}

export interface GitOpsInfo {
    status: GitOpsStatus;
    releaseName?: string;
    releaseNamespace?: string;
    chart?: string;
    repoUrl?: string;
    branch?: string;
    valuesPath?: string;
    helmKey?: string;
}

const ANNOTATIONS = {
    HELM_RELEASE_NAME: 'meta.helm.sh/release-name',
    HELM_RELEASE_NAMESPACE: 'meta.helm.sh/release-namespace',
    HELM_CHART: 'helm.sh/chart',
    GITOPS_REPO: 'cnpg-admin.io/gitops-repo',
    GITOPS_VALUES_PATH: 'cnpg-admin.io/gitops-values-path',
    GITOPS_HELM_KEY: 'cnpg-admin.io/gitops-helm-key',
};

export function getGitOpsStatus(metadata: V1ObjectMeta): GitOpsInfo {
    const annotations = metadata.annotations || {};

    const releaseName = annotations[ANNOTATIONS.HELM_RELEASE_NAME];
    const releaseNamespace = annotations[ANNOTATIONS.HELM_RELEASE_NAMESPACE];
    const chart = annotations[ANNOTATIONS.HELM_CHART];

    const repoUrl = annotations[ANNOTATIONS.GITOPS_REPO];
    const valuesPath = annotations[ANNOTATIONS.GITOPS_VALUES_PATH];
    const helmKey = annotations[ANNOTATIONS.GITOPS_HELM_KEY];

    if (!releaseName) {
        return { status: GitOpsStatus.NOT_GITOPS };
    }

    if (repoUrl && valuesPath) {
        return {
            status: GitOpsStatus.HELM_GITOPS,
            releaseName,
            releaseNamespace,
            chart,
            repoUrl,
            valuesPath,
            helmKey,
        };
    }

    return {
        status: GitOpsStatus.HELM_UNCONNECTED,
        releaseName,
        releaseNamespace,
        chart,
    };
}

/**
 * Enhanced discovery that fallbacks to Helm secret scanning
 */
export async function discoverGitOpsStatus(cluster: any): Promise<GitOpsInfo> {
    const syncStatus = getGitOpsStatus(cluster.metadata);
    if (syncStatus.status !== GitOpsStatus.NOT_GITOPS) {
        return syncStatus;
    }

    try {
        // Fallback: Check if there's a Helm release managing this cluster
        const releases = await listReleases(cluster.metadata.namespace);
        // Match by cluster name
        const match = releases.find(r => r.name === cluster.metadata.name);

        if (match) {
            return {
                status: GitOpsStatus.HELM_UNCONNECTED,
                releaseName: match.name,
                releaseNamespace: match.namespace,
                chart: `${match.chart}-${match.chartVersion}`,
            };
        }
    } catch (e) {
        console.warn('[detector] Fallback discovery failed:', e);
    }

    return syncStatus;
}
