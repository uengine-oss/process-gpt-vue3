<template>
    <!-- 다이어그램 우측에 떠 있는 Top 3 애니메이션 막대. body 로 teleport. -->
    <Teleport to="body">
        <div v-if="visible" class="itb-wrap">
            <div v-for="(item, i) in top3" :key="item.topic_id" class="itb-row">
                <div class="itb-fill" :style="{ width: grow ? fillWidth(item) : '0px' }">
                    <span class="itb-name" :title="item.topic_name">{{ shortName(item.topic_name) }}</span>
                    <span class="itb-pct">{{ displayPct[i] != null ? displayPct[i].toFixed(1) : '0.0' }}%</span>
                </div>
            </div>
            <div class="itb-more" @click="goDetail">자세히...</div>
        </div>
    </Teleport>
</template>

<script>
import InstanceClassifierAPI from '@/utils/instanceClassifier';

const TRACK = 400; // 막대 최대 길이(px) — 1위 유형 기준
const MIN_W = 215; // 텍스트가 들어갈 최소 길이(하위 유형도 이름이 보이도록)

export default {
    name: 'InstanceTopBars',
    props: {
        procDefId: { type: String, required: true }
    },
    data() {
        return { items: [], loaded: false, grow: false, displayPct: [], _raf: null };
    },
    computed: {
        top3() {
            return this.items.filter((i) => !i.is_noise).slice(0, 3);
        },
        visible() {
            return this.loaded && this.top3.length > 0;
        },
        maxPct() {
            return Math.max(1, ...this.top3.map((i) => i.pct || 0));
        }
    },
    watch: {
        procDefId: { immediate: true, handler() { this.load(); } }
    },
    beforeUnmount() {
        if (this._raf) cancelAnimationFrame(this._raf);
    },
    methods: {
        async load() {
            if (!this.procDefId) return;
            this.loaded = false;
            try {
                // 기본 기준: 최근 1주
                const data = await InstanceClassifierAPI.topList(this.procDefId, 'week');
                this.items = data.items || [];
            } catch (e) {
                this.items = [];
            } finally {
                this.loaded = true;
                if (this.top3.length) this.$nextTick(this.animate);
            }
        },
        animate() {
            if (this._raf) cancelAnimationFrame(this._raf);
            this.grow = false;
            this.displayPct = this.top3.map(() => 0);
            const targets = this.top3.map((t) => t.pct || 0);
            // 다음 프레임에 grow=true → CSS width 트랜지션 시작 + 숫자 카운트업
            requestAnimationFrame(() => {
                this.grow = true;
                const start = performance.now();
                const dur = 950;
                const tick = (now) => {
                    const p = Math.min(1, (now - start) / dur);
                    const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
                    this.displayPct = targets.map((v) => v * e);
                    if (p < 1) {
                        this._raf = requestAnimationFrame(tick);
                    } else {
                        this.displayPct = targets.slice();
                    }
                };
                this._raf = requestAnimationFrame(tick);
            });
        },
        fillWidth(item) {
            // 기준선(MIN_W) + 비율에 비례한 추가 길이 → 하위 유형 이름도 보이되 길이는 %에 비례.
            const ratio = (item.pct || 0) / this.maxPct;
            return Math.round(MIN_W + ratio * (TRACK - MIN_W)) + 'px';
        },
        shortName(n) {
            if (!n) return '';
            return n.length > 20 ? n.slice(0, 19) + '…' : n;
        },
        goDetail() {
            this.$router.push('/instance-toplist').catch(() => {});
        }
    }
};
</script>

<style scoped>
.itb-wrap {
    position: fixed;
    right: 28px;
    top: 24vh;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 14px;
}
.itb-row {
    display: flex;
    justify-content: flex-end;
    width: 400px;
}
.itb-fill {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 46px;
    padding: 0 18px;
    border-radius: 12px;
    overflow: hidden;
    white-space: nowrap;
    /* 반투명 유리(테마 primary 라이트블루) */
    background: rgba(var(--v-theme-primary), 0.13);
    backdrop-filter: blur(10px) saturate(140%);
    -webkit-backdrop-filter: blur(10px) saturate(140%);
    box-shadow: 0 3px 12px rgba(var(--v-theme-primary), 0.12);
    transition: width 0.95s cubic-bezier(0.22, 1, 0.36, 1);
    will-change: width;
}
.itb-name {
    font-size: 15px;
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
    overflow: hidden;
    text-overflow: ellipsis;
}
.itb-pct {
    font-size: 15px;
    font-weight: 800;
    color: rgb(var(--v-theme-primary));
    font-variant-numeric: tabular-nums;
    flex: 0 0 auto;
}
.itb-more {
    margin-top: 2px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
    text-decoration: underline;
    opacity: 0.9;
}
.itb-more:hover {
    opacity: 1;
}
</style>
