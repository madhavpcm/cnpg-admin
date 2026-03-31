import { SyncService } from '@/lib/sync';
import { getGitService } from '@/lib/git';
import { SyncState } from '@/lib/types/gitops';

class DriftReconciler {
    private cache: SyncState | null = null;
    private isReconciling = false;

    public async getCachedDrift(): Promise<SyncState | null> {
        if (!this.cache && !this.isReconciling) {
            // First time or empty cache, trigger async fetch
            this.triggerReconciliation();
        }
        return this.cache;
    }

    public async triggerReconciliation() {
        if (this.isReconciling) return;
        this.isReconciling = true;
        try {
            console.log('[DriftReconciler] Starting background drift check...');
            const gitService = await getGitService();
            if (!gitService) {
                console.log('[DriftReconciler] GitOps not configured, aborting drift diff.');
                return;
            }
            
            const syncService = new SyncService(gitService);
            const status = await syncService.getSyncStatus();
            this.cache = status;
            console.log(`[DriftReconciler] Drift check complete. Status: ${status.status}, Clusters: ${Object.keys(status.clusters).length}`);
        } catch (e: any) {
            console.error('[DriftReconciler] Failed to reconcile drift:', e.message || e);
        } finally {
            this.isReconciling = false;
        }
    }
}

export const driftReconciler = new DriftReconciler();
