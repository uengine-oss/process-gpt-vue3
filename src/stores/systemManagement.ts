import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';
import { getCurrentUserForSoftDelete } from '@/utils/softDeleteUser';

export interface System {
    id?: string;
    name: string;
    system_type?: string;
    category?: string;
    description?: string;
    shortcut_link?: string;
    is_active?: number;
    responsible_org_id?: string | null;
    responsible_person?: string | null;
    registration_status?: string;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    created_by_display?: string;
    deleted_at?: string | null;
    deleted_by?: string | null;
}

function auditSystemValue(system?: Partial<System> | null) {
    if (!system) return null;
    return {
        id: system.id || null,
        name: system.name || '',
        system_type: system.system_type || '',
        category: system.category || '',
        responsible_person: system.responsible_person || '',
        shortcut_link: system.shortcut_link || '',
        description: system.description || '',
        registration_status: system.registration_status || '',
        created_by: system.created_by || '',
        created_by_display: system.created_by_display || '',
        deleted_at: system.deleted_at || null,
        deleted_by: system.deleted_by || null
    };
}

function getCurrentSystemCreator() {
    const display = getCurrentUserForSoftDelete();
    const id =
        window.localStorage.getItem('employeeNo') ||
        window.localStorage.getItem('email') ||
        window.localStorage.getItem('uid') ||
        (window as any).$user?.email ||
        (window as any).$user?.id ||
        (window as any).$userName ||
        display;

    return {
        created_by: id,
        created_by_display: display
    };
}

async function writeSystemAuditLog(entry: {
    action: string;
    target_id?: string;
    target_name?: string;
    before_value?: any;
    after_value?: any;
    comment?: string;
}) {
    try {
        const backend = BackendFactory.createBackend() as any;
        await backend.insertAdminAuditLog({
            target_type: 'system',
            ...entry
        });
    } catch (error) {
        console.error('Failed to write system audit log:', error);
    }
}

export const useSystemManagementStore = defineStore('systemManagement', {
    state: () => ({
        systems: [] as System[],
        loading: false,
        loaded: false,
        error: null as string | null
    }),

    getters: {
        sortedSystems(state): System[] {
            return [...state.systems].sort((a, b) => {
                const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                return bTime - aTime;
            });
        },

    },

    actions: {
        async loadSystems() {
            if (this.loaded) return;
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.getSystemList();
                this.systems = Array.isArray(result) ? result.filter((system) => !system.deleted_at) : [];
                this.loaded = true;
            } catch (error: any) {
                console.error('Failed to load systems:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },

        async saveSystem(system: Partial<System>) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const before = system.id ? this.systems.find((s) => s.id === system.id) || null : null;
                const payload = before ? system : { ...system, ...getCurrentSystemCreator() };
                const saved = await backend.putSystem(payload);
                if (saved && saved.id) {
                    const index = this.systems.findIndex((s) => s.id === saved.id);
                    if (index !== -1) {
                        this.systems[index] = saved;
                    } else {
                        this.systems.push(saved);
                    }
                } else {
                    // 백엔드가 저장된 객체를 반환하지 않을 경우 전체 리로드
                    this.loaded = false;
                    await this.loadSystems();
                }
                await writeSystemAuditLog({
                    action: before ? 'system_update' : 'system_create',
                    target_id: (saved && saved.id) || system.id,
                    target_name: (saved && saved.name) || system.name,
                    before_value: before ? auditSystemValue(before) : null,
                    after_value: auditSystemValue(saved || payload)
                });
                return saved;
            } catch (error: any) {
                console.error('Failed to save system:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        async deleteSystem(system: System) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const deletedBy = getCurrentUserForSoftDelete();
                const deletedAt = new Date().toISOString();
                await (backend as any).softDeleteSystem(system, deletedBy);
                this.systems = this.systems.filter((s) => s.id !== system.id && s.name !== system.name);
                await writeSystemAuditLog({
                    action: 'system_soft_delete',
                    target_id: system.id,
                    target_name: system.name,
                    before_value: auditSystemValue(system),
                    after_value: auditSystemValue({ ...system, deleted_at: deletedAt, deleted_by: deletedBy }),
                    comment: '휴지통으로 이동'
                });
            } catch (error: any) {
                console.error('Failed to delete system:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        async refreshSystems() {
            this.loaded = false;
            await this.loadSystems();
        }
    }
});
