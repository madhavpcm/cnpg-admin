export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { driftReconciler } from '@/lib/gitops/reconciler';

export async function GET() {
    try {
        let status = await driftReconciler.getCachedDrift();
        
        // If cache is empty, we must trigger an immediate calculation and wait for it
        if (!status) {
            await driftReconciler.triggerReconciliation();
            status = await driftReconciler.getCachedDrift();
            if (!status) {
             return NextResponse.json({
                 lastSync: new Date().toISOString(),
                 clusters: {}
             });
            }
        }
        
        // Trigger background calculate for the *next* request to ensure freshness
        void driftReconciler.triggerReconciliation();
        return NextResponse.json(status);
    } catch (error: any) {
        console.error('[api/gitops/drift] GET failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST() {
    try {
        await driftReconciler.triggerReconciliation();
        return NextResponse.json({ message: 'Reconciliation triggered' });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
