import { Octokit } from '@octokit/rest';
import { GitOpsConfig } from './types/gitops';
import { getGitOpsConfig, getGitToken } from './k8s';
import { parseClusterYaml } from './yaml';

export class GitService {
    private octokit: Octokit;
    private owner: string;
    private repo: string;
    private branch: string;
    private path: string;

    constructor(token: string, owner: string, repo: string, branch: string = 'main', path: string = 'clusters') {
        this.octokit = new Octokit({ auth: token });
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
        this.path = path.endsWith('/') ? path.slice(0, -1) : path;
    }

    static async fromConfig(): Promise<GitService | null> {
        const config = await getGitOpsConfig();
        if (!config || !config.repoUrl) return null;

        const token = await getGitToken();

        let url = config.repoUrl;
        url = url.replace('https://github.com/', '')
                 .replace('http://github.com/', '')
                 .replace('github.com/', '');
        
        const urlParts = url.split('/');
        if (urlParts.length < 2) return null;

        const owner = urlParts[0];
        const repo = urlParts[1].replace('.git', '');

        return new GitService(token || '', owner, repo, config.branch, config.path);
    }

    async getFile(path: string): Promise<{ content: string; sha: string } | null> {
        try {
            const { data }: any = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: path,
                ref: this.branch,
            });
            if (Array.isArray(data)) return null;
            return {
                content: Buffer.from(data.content, 'base64').toString('utf8'),
                sha: data.sha,
            };
        } catch (e: any) {
            if (e.status !== 404) {
                console.error(`[git] getFile error for ${path}: status=${e.status}, msg=${e.message}`);
            }
            return null;
        }
    }

    async listClusters(): Promise<any[]> {
        try {
            const { data }: any = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: this.path,
                ref: this.branch,
            });

            const clusters: any[] = [];
            for (const item of data) {
                if (item.type === 'dir') {
                    // Item is <cluster-id>, now look for <namespace>/<name>.yaml
                    const { data: nsData }: any = await this.octokit.repos.getContent({
                        owner: this.owner,
                        repo: this.repo,
                        path: item.path,
                        ref: this.branch,
                    });

                    for (const nsItem of nsData) {
                        if (nsItem.type === 'dir') {
                            const { data: files }: any = await this.octokit.repos.getContent({
                                owner: this.owner,
                                repo: this.repo,
                                path: nsItem.path,
                                ref: this.branch,
                            });
                            for (const file of files) {
                                if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                                    const content = await this.getFile(file.path);
                                    if (content) {
                                        try {
                                            const cluster = parseClusterYaml(content.content);
                                            clusters.push({
                                                ...cluster,
                                                _git: { path: file.path, sha: content.sha }
                                            });
                                        } catch (err) {
                                            console.warn(`[git] Failed to parse ${file.path}:`, err);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return clusters;
        } catch (e) {
            console.error('[git] listClusters failed:', e);
            return [];
        }
    }

    async pushCluster(ns: string, name: string, content: string, message?: string) {
        const clusterId = 'production'; // TODO: make dynamic
        const filePath = `${this.path}/${clusterId}/${ns}/${name}.yaml`.replace(/^\//, '');
        const existing = await this.getFile(filePath);

        try {
            return await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                message: message || `Update cluster ${name} in ${ns}`,
                content: Buffer.from(content).toString('base64'),
                branch: this.branch,
                sha: existing?.sha,
            });
        } catch (e: any) {
            console.error(`[git] pushCluster failed for ${filePath}. existing_sha=${existing?.sha}, status=${e.status}, msg=${e.message}`);
            throw e;
        }
    }

    async deleteClusterFile(ns: string, name: string, message?: string) {
        const clusterId = 'production';
        const filePath = `${this.path}/${clusterId}/${ns}/${name}.yaml`;
        const existing = await this.getFile(filePath);
        if (!existing) return;

        return this.octokit.repos.deleteFile({
            owner: this.owner,
            repo: this.repo,
            path: filePath,
            message: message || `Delete cluster ${name} from ${ns}`,
            sha: existing.sha,
            branch: this.branch,
        });
    }

    async createPR(ns: string, name: string, content: string, title: string, body: string = ''): Promise<string> {
        const clusterId = 'production'; // TODO: make dynamic
        const filePath = `${this.path}/${clusterId}/${ns}/${name}.yaml`;
        
        // 1. Get base branch SHA
        const { data: ref } = await this.octokit.git.getRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${this.branch}`,
        });
        const baseSha = ref.object.sha;

        // 2. Create a new branch
        const newBranch = `cnpg-admin/cluster-${name}-${Date.now()}`;
        await this.octokit.git.createRef({
            owner: this.owner,
            repo: this.repo,
            ref: `refs/heads/${newBranch}`,
            sha: baseSha,
        });

        // 3. Create or Update file in new branch
        const existing = await this.getFile(filePath);
        await this.octokit.repos.createOrUpdateFileContents({
            owner: this.owner,
            repo: this.repo,
            path: filePath,
            message: title,
            content: Buffer.from(content).toString('base64'),
            branch: newBranch,
            sha: existing?.sha,
        });

        // 4. Create Pull Request
        const { data: pr } = await this.octokit.pulls.create({
            owner: this.owner,
            repo: this.repo,
            title: title,
            head: newBranch,
            base: this.branch,
            body: body,
        });

        return pr.html_url;
    }

    async hasOpenPR(ns: string, name: string): Promise<boolean> {
        try {
            const { data: prs } = await this.octokit.pulls.list({
                owner: this.owner,
                repo: this.repo,
                state: 'open',
            });

            const branchPrefix = `cnpg-admin/cluster-${name}-`;
            return prs.some((pr: any) => pr.head.ref.startsWith(branchPrefix));
        } catch (e: any) {
            console.error('[git] Failed to check for open PRs:', e.message || e);
            return false; // Fail open if github API errors
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.octokit.repos.get({
                owner: this.owner,
                repo: this.repo,
            });
            return true;
        } catch (e: any) {
            console.error('[git] testConnection failed for', this.owner, '/', this.repo, ':', e.message || e);
            throw e;
        }
    }
}

export async function getGitService(): Promise<GitService | null> {
    return GitService.fromConfig();
}
