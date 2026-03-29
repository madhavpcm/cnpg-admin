import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

const INDEX_ROOT = process.env.GITNEXUS_INDEX_PATH || '/tmp/cnpg-gitops-indexes';

export async function ensureIndexDir() {
    try {
        await fs.mkdir(INDEX_ROOT, { recursive: true });
    } catch (e) { }
}

export async function indexRepo(repoUrl: string, repoDir: string): Promise<void> {
    await ensureIndexDir();
    console.log(`[gitnexus] Indexing repo ${repoUrl} at ${repoDir}`);

    // lbug index <dir>
    // Assuming lbug is in PATH
    try {
        const { stdout, stderr } = await execFileAsync('lbug', ['index', repoDir]);
        console.log('[gitnexus] Indexing result:', stdout);
    } catch (e) {
        console.error('[gitnexus] Indexing failed:', e);
        throw e;
    }
}

export interface ResolveResult {
    file: string;
    keyPath: string;
    confidence: number;
    source: string;
}

export async function queryGitNexus(repoDir: string, releaseName: string, clusterName: string): Promise<ResolveResult | null> {
    // This is a simplified version that would ideally use the MCP stdio transport.
    // For Phase 3, we'll implement a heuristic that uses the index structurally
    // or just shells out to lbug query if available.

    // Mocking the MCP query for now as per design
    console.log(`[gitnexus] Querying for release=${releaseName}, cluster=${clusterName}`);

    return {
        file: 'values.yaml',
        keyPath: 'cluster.instances',
        confidence: 0.9,
        source: 'gitnexus'
    };
}
