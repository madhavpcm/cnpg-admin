import { getCoreApi, namespace } from '@/lib/k8s';

export interface RepoConfig {
    id: string;
    url: string;
    branch: string;
    token?: string;
}

const SECRET_LABEL = 'cnpg-admin.io/gitops-secret';

function getRepoId(url: string): string {
    return Buffer.from(url).toString('hex').slice(0, 12);
}

export async function listRepos(): Promise<RepoConfig[]> {
    try {
        const coreApi = getCoreApi();
        const res = await coreApi.listNamespacedSecret({
            namespace,
            labelSelector: `${SECRET_LABEL}=true`,
        });

        return res.items.map(s => {
            const data = s.data || {};
            const decode = (v?: string) => v ? Buffer.from(v, 'base64').toString('utf-8') : '';
            return {
                id: s.metadata?.name?.replace('cnpg-gitops-', '') || '',
                url: decode(data.url),
                branch: decode(data.branch),
                token: decode(data.token),
            };
        });
    } catch (e) {
        console.error('[gitops/storage] Failed to list repos:', e);
        return [];
    }
}

export async function saveRepo(url: string, branch: string, token?: string): Promise<string> {
    const id = getRepoId(url);
    const secretName = `cnpg-gitops-${id}`;
    const coreApi = getCoreApi();

    const encode = (v: string) => Buffer.from(v).toString('base64');
    const secretBody = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
            name: secretName,
            namespace,
            labels: {
                [SECRET_LABEL]: 'true'
            }
        },
        type: 'Opaque',
        data: {
            url: encode(url),
            branch: encode(branch),
            token: encode(token || ''),
        }
    };

    try {
        await coreApi.readNamespacedSecret({ name: secretName, namespace });
        await coreApi.replaceNamespacedSecret({ name: secretName, namespace, body: secretBody });
    } catch (e: any) {
        if (e.status === 404) {
            await coreApi.createNamespacedSecret({ namespace, body: secretBody });
        } else {
            throw e;
        }
    }

    return id;
}
