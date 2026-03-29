export interface ChartSchema {
    instancesPath: string;
    storagePath: string;
    imagePath: string;
    nameFromRelease: boolean;
    clusterNamePath?: string;
}

export const CNPG_CHART_REGISTRY: Record<string, ChartSchema> = {
    // Official cloudnative-pg/cluster chart
    "cluster": {
        instancesPath: "cluster.instances",
        storagePath: "cluster.storage.size",
        imagePath: "cluster.imageName",
        nameFromRelease: true,
    },
    // Common community / custom wrapper charts
    "cnpg-cluster": {
        instancesPath: "instances",
        storagePath: "storage.size",
        imagePath: "imageName",
        nameFromRelease: false,
        clusterNamePath: "nameOverride",
    },
    // Another variant
    "postgresql-cluster": {
        instancesPath: "postgresql.instances",
        storagePath: "postgresql.storage.size",
        imagePath: "postgresql.image",
        nameFromRelease: true,
    }
};

export function getSchemeForChart(chartLabel?: string): ChartSchema | null {
    if (!chartLabel) return null;
    // helm.sh/chart is usually name-version, e.g. cluster-0.3.0
    const name = chartLabel.split('-')[0];
    return CNPG_CHART_REGISTRY[name] || null;
}
