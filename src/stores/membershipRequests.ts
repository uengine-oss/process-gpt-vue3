import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getRequestCounts } from '@/services/membershipService';

export const useMembershipRequestsStore = defineStore('membershipRequests', () => {
    const counts = ref({ signup: 0, role: 0, total: 0 });
    const error = ref('');
    let inflight: Promise<void> | null = null;
    function refresh() {
        if (inflight) return inflight;
        inflight = (async () => {
            try { counts.value = await getRequestCounts(); error.value = ''; }
            catch (e: any) { error.value = e.message || '신청 건수를 불러오지 못했습니다.'; }
            finally { inflight = null; }
        })();
        return inflight;
    }
    function reset() { counts.value = { signup: 0, role: 0, total: 0 }; error.value = ''; }
    return { counts, error, refresh, reset };
});
