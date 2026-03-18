import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';

export interface DataFreezeItem {
    id?: string;
    scope: 'domain' | 'mega_process' | 'major_process' | 'subprocess';
    target_id: string;
    target_name: string;
    reason: string;
    locked_by: string;
    locked_at: string;
}

export interface DeletedProcess {
    id: string;
    name: string;
    deleted_by?: string;
    deleted_at: string;
    remaining_days: number;
    deleted_from?: {
        mega_id: string;
        mega_name: string;
        major_id: string;
        major_name: string;
        process_name?: string;
    } | null;
}

export interface DeletedInstance {
    proc_inst_id: string;
    name?: string;
    deleted_at: string;
    remaining_days: number;
}

export interface KpiTarget {
    id?: string;
    year: number;
    org_id: string;
    org_name: string;
    target: number;
    published_count?: number;
    achievement_rate?: number;
    period_type?: string;
    period_start?: string;
    updated_at?: string;
}

export interface NoticeBannerConfig {
    enabled: boolean;
    text: string;
    color: 'info' | 'warning' | 'error' | 'success';
    start_date: string;
    end_date: string;
}

export interface MaintenanceModeConfig {
    enabled: boolean;
    message: string;
    activated_by?: string;
    activated_at?: string;
}

export interface AuditLogEntry {
    id: string;
    proc_def_id: string;
    review_id?: string;
    action: string;
    from_state: string;
    to_state: string;
    actor_id: string;
    comment?: string;
    created_at: string;
    proc_def_name?: string;
}

export interface AuditFilter {
    startDate?: string;
    endDate?: string;
    action?: string;
    actorId?: string;
    procDefId?: string;
    page?: number;
    pageSize?: number;
}

export interface SignupRequest {
    id: string;
    user_id: string;
    username?: string;
    email: string;
    tenant_id: string;
    status: 'pending' | 'approved' | 'rejected';
    reject_reason?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    created_at: string;
    updated_at?: string | null;
}

export const useAdminConsoleStore = defineStore({
    id: 'adminConsole',
    state: () => ({
        activeTab: 'schemas' as string,
        dataFreezeList: [] as DataFreezeItem[],
        deletedProcesses: [] as DeletedProcess[],
        deletedInstances: [] as DeletedInstance[],
        kpiTargets: [] as KpiTarget[],
        noticeBanner: {
            enabled: false,
            text: '',
            color: 'info',
            start_date: '',
            end_date: ''
        } as NoticeBannerConfig,
        maintenanceMode: {
            enabled: false,
            message: '',
            activated_by: '',
            activated_at: ''
        } as MaintenanceModeConfig,
        signupRequests: [] as SignupRequest[],
        auditLogs: [] as AuditLogEntry[],
        auditTotal: 0,
        loading: false,
        error: null as string | null
    }),

    actions: {
        // ============================================
        // Data Freeze
        // ============================================
        async fetchDataFreezeList() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.dataFreezeList = (await backend.getDataFreezeList()) || [];
            } catch (e: any) {
                console.error('Failed to fetch data freeze list:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async setDataFreeze(item: Omit<DataFreezeItem, 'id' | 'locked_by' | 'locked_at'>) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.setDataFreeze(item);
                await this.fetchDataFreezeList();
            } catch (e: any) {
                console.error('Failed to set data freeze:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async removeDataFreeze(targetId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.removeDataFreeze(targetId);
                await this.fetchDataFreezeList();
            } catch (e: any) {
                console.error('Failed to remove data freeze:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Recycle Bin
        // ============================================
        async fetchDeletedProcesses() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.deletedProcesses = await backend.getDeletedProcesses();
            } catch (e: any) {
                console.error('Failed to fetch deleted processes:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async fetchDeletedInstances() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const list = await backend.getDeletedInstances();
                this.deletedInstances = (list || []).map((inst: any) => ({
                    ...inst,
                    remaining_days: inst.deleted_at
                        ? Math.max(0, 30 - Math.floor((Date.now() - new Date(inst.deleted_at).getTime()) / 86400000))
                        : 30
                }));
            } catch (e: any) {
                console.error('Failed to fetch deleted instances:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async restoreProcess(procDefId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.restoreProcess(procDefId);
                this.deletedProcesses = this.deletedProcesses.filter(p => p.id !== procDefId);
            } catch (e: any) {
                console.error('Failed to restore process:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteProcess(procDefId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.hardDeleteProcess(procDefId);
                this.deletedProcesses = this.deletedProcesses.filter(p => p.id !== procDefId);
            } catch (e: any) {
                console.error('Failed to hard delete process:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async restoreInstance(instId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.restoreInstance(instId);
                this.deletedInstances = this.deletedInstances.filter(i => i.proc_inst_id !== instId);
            } catch (e: any) {
                console.error('Failed to restore instance:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteInstance(instId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.hardDeleteInstance(instId);
                this.deletedInstances = this.deletedInstances.filter(i => i.proc_inst_id !== instId);
            } catch (e: any) {
                console.error('Failed to hard delete instance:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // KPI Targets
        // ============================================
        async fetchKpiTargets(year?: number) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const targets = await backend.getKpiTargets();
                const publishedCounts = await backend.getPublishedCountByOrg();

                this.kpiTargets = (targets || [])
                    .filter((t: any) => !year || new Date(t.period_start).getFullYear() === year)
                    .map((t: any) => {
                        const orgId = t.org_id || t.domain_id || '';
                        const published = publishedCounts[orgId] || 0;
                        const target = t.target_value || t.target || 0;
                        return {
                            id: t.id,
                            year: new Date(t.period_start).getFullYear(),
                            org_id: orgId,
                            org_name: t.org_name || t.domain_name || orgId,
                            target: target,
                            published_count: published,
                            achievement_rate: target > 0 ? Math.round((published / target) * 100) : 0,
                            period_type: t.period_type,
                            period_start: t.period_start,
                            updated_at: t.updated_at
                        };
                    });
            } catch (e: any) {
                console.error('Failed to fetch KPI targets:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async saveKpiTarget(target: KpiTarget) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.upsertKpiTarget({
                    org_id: target.org_id,
                    org_name: target.org_name,
                    target_value: target.target,
                    period_type: 'yearly',
                    period_start: `${target.year}-01-01`
                });
                await this.fetchKpiTargets(target.year);
            } catch (e: any) {
                console.error('Failed to save KPI target:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async deleteKpiTarget(id: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.deleteKpiTarget(id);
                this.kpiTargets = this.kpiTargets.filter(t => t.id !== id);
            } catch (e: any) {
                console.error('Failed to delete KPI target:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Notice Banner
        // ============================================
        async fetchNoticeBanner() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const config = await backend.getNoticeBanner();
                if (config) {
                    this.noticeBanner = config;
                }
            } catch (e: any) {
                console.error('Failed to fetch notice banner:', e);
            }
        },

        async saveNoticeBanner(config: NoticeBannerConfig) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.saveNoticeBanner(config);
                this.noticeBanner = config;
            } catch (e: any) {
                console.error('Failed to save notice banner:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Maintenance Mode
        // ============================================
        async fetchMaintenanceMode() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const config = await backend.getMaintenanceMode();
                if (config) {
                    this.maintenanceMode = config;
                }
            } catch (e: any) {
                console.error('Failed to fetch maintenance mode:', e);
            }
        },

        async toggleMaintenanceMode(enabled: boolean, message?: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const config = {
                    enabled,
                    message: message || this.maintenanceMode.message,
                    activated_by: enabled ? ((window as any).$userName || 'admin') : '',
                    activated_at: enabled ? new Date().toISOString() : ''
                };
                await backend.setMaintenanceMode(config);
                this.maintenanceMode = config;
            } catch (e: any) {
                console.error('Failed to toggle maintenance mode:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Audit Logs
        // ============================================
        async fetchAuditLogs(filters?: AuditFilter) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const result = await backend.getAllAuditLogs(filters);
                this.auditLogs = result.data || result;
                this.auditTotal = result.total || this.auditLogs.length;
            } catch (e: any) {
                console.error('Failed to fetch audit logs:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Signup Requests
        // ============================================
        async fetchSignupRequests(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all') {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.signupRequests = (await backend.getSignupRequests(status)) || [];
            } catch (e: any) {
                console.error('Failed to fetch signup requests:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async approveSignupRequest(requestId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.approveSignupRequest(requestId);
                this.signupRequests = this.signupRequests.map((item) =>
                    item.id === requestId
                        ? {
                              ...item,
                              status: 'approved'
                          }
                        : item
                );
            } catch (e: any) {
                console.error('Failed to approve signup request:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async rejectSignupRequest(requestId: string, rejectReason = '') {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.rejectSignupRequest(requestId, rejectReason);
                this.signupRequests = this.signupRequests.map((item) =>
                    item.id === requestId
                        ? {
                              ...item,
                              status: 'rejected',
                              reject_reason: rejectReason
                          }
                        : item
                );
            } catch (e: any) {
                console.error('Failed to reject signup request:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        }
    }
});
