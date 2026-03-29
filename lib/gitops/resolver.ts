import { V1ObjectMeta } from '@kubernetes/client-node';
import { getSchemeForChart } from './chart-registry';
import { queryGitNexus, ResolveResult } from './gitnexus';
import { GitOpsInfo } from './detector';

export async function resolvePath(
    metadata: V1ObjectMeta,
    gitops: GitOpsInfo,
    repoDir?: string
): Promise<ResolveResult> {
    const annotations = metadata.annotations || {};

    // Layer 0: Cache
    if (gitops.helmKey && gitops.valuesPath) {
        return {
            file: gitops.valuesPath,
            keyPath: gitops.helmKey,
            confidence: 1.0,
            source: 'cache'
        };
    }

    // Layer 1: Chart Registry
    const chart = annotations['helm.sh/chart'];
    const schema = getSchemeForChart(chart);
    if (schema) {
        // For the official cluster chart, the path is deterministic
        // Often it's just 'values.yaml' if we don't know yet, but the key is solid
        return {
            file: gitops.valuesPath || 'values.yaml',
            keyPath: schema.instancesPath.split('.').slice(0, -1).join('.'), // Parent key
            confidence: 0.95,
            source: 'registry'
        };
    }

    // Layer 2: GitNexus MCP
    if (repoDir && gitops.releaseName) {
        const result = await queryGitNexus(repoDir, gitops.releaseName, metadata.name || '');
        if (result && result.confidence > 0.7) {
            return result;
        }
    }

    // Layer 3: Fallback (LLM or just a guess)
    return {
        file: gitops.valuesPath || 'values.yaml',
        keyPath: 'cluster', // Standard default guess
        confidence: 0.1,
        source: 'guess'
    };
}
