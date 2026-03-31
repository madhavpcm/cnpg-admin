import * as yaml from 'js-yaml';

export function parseClusterYaml(content: string): any {
    try {
        const doc = yaml.load(content) as any;
        if (!doc || doc.kind !== 'Cluster') {
            throw new Error('Not a valid CNPG Cluster manifest');
        }
        return doc;
    } catch (e) {
        throw new Error('Failed to parse YAML: ' + (e as any).message);
    }
}

export function stringifyClusterYaml(cluster: any): string {
    // Filter out K8s system status and metadata
    const clean: any = {
        apiVersion: cluster.apiVersion || 'postgresql.cnpg.io/v1',
        kind: 'Cluster',
        metadata: {
            name: cluster.metadata.name,
            namespace: cluster.metadata.namespace,
            labels: {
                ...(cluster.metadata.labels || {}),
                'managed-by': 'cnpg-admin'
            },
            annotations: cluster.metadata.annotations,
        },
        spec: cluster.spec,
    };

    // Remove managed fields and other internal noise
    if (clean.metadata.managedFields) delete clean.metadata.managedFields;
    if (clean.metadata.uid) delete clean.metadata.uid;
    if (clean.metadata.resourceVersion) delete clean.metadata.resourceVersion;
    if (clean.metadata.creationTimestamp) delete clean.metadata.creationTimestamp;
    if (clean.metadata.generation) delete clean.metadata.generation;
    if (clean.metadata.selfLink) delete clean.metadata.selfLink;

    return yaml.dump(clean, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
    });
}
