<template>
    <div class="app-workitem">
        <div class="app-workitem-bar">
            <v-icon size="16" class="mr-1">mdi-application-brackets-outline</v-icon>
            <span class="app-name">{{ handler.name }}</span>
            <span class="app-hint">{{ readonly ? '조회 · 업무 시스템 화면' : '업무 시스템 화면에서 확인·수정 후 제출' }}</span>
            <v-spacer></v-spacer>
            <span v-if="lastSync" class="app-hint">값 동기화 {{ lastSync }}</span>
        </div>
        <iframe ref="frame" :src="handler.url" class="app-workitem-frame" :style="{ height: height + 'px' }" @load="sendInit"></iframe>
    </div>
</template>

<script>
/**
 * 외부 앱 화면을 워크아이템으로 임베드한다 — postMessage 계약 (protocol 1)
 *
 *   Process GPT → 앱
 *     { type: 'pgpt:workitem:init', protocol: 1, workitem: { taskId, procInstId, procDefId, activityId, activityName,
 *       formId, status, readonly, values, user: { email, name } } }
 *   앱 → Process GPT
 *     { type: 'pgpt:workitem:ready' }                  init 을 다시 보내 달라
 *     { type: 'pgpt:workitem:values', values }         폼 값(데이터 계약)에 병합한다
 *     { type: 'pgpt:workitem:save', values }           병합 후 중간 저장
 *     { type: 'pgpt:workitem:submit', values }         병합 후 제출 완료 (기존 폼 제출과 같은 경로)
 *     { type: 'pgpt:workitem:resize', height }
 */
export default {
    name: 'AppWorkItemFrame',
    props: {
        handler: { type: Object, required: true },
        workItem: { type: Object, required: true },
        formId: { type: String, default: '' },
        values: { type: Object, default: () => ({}) },
        readonly: { type: Boolean, default: false }
    },
    emits: ['values', 'save', 'submit'],
    data: () => ({ height: 760, lastSync: '' }),
    mounted() {
        window.addEventListener('message', this.onMessage);
    },
    beforeUnmount() {
        window.removeEventListener('message', this.onMessage);
    },
    watch: {
        readonly() {
            this.sendInit();
        }
    },
    methods: {
        context() {
            const wl = this.workItem?.worklist || {};
            const act = this.workItem?.activity || {};
            return {
                taskId: this.$route?.params?.taskId || wl.taskId || '',
                procInstId: wl.instId || '',
                procDefId: wl.defId || '',
                activityId: act.tracingTag || wl.tracingTag || '',
                activityName: act.name || wl.title || '',
                formId: this.formId,
                status: wl.status || '',
                readonly: this.readonly,
                values: JSON.parse(JSON.stringify(this.values || {})),
                user: { email: localStorage.getItem('email') || '', name: localStorage.getItem('userName') || '' }
            };
        },
        sendInit() {
            const w = this.$refs.frame?.contentWindow;
            if (w) w.postMessage({ type: 'pgpt:workitem:init', protocol: 1, workitem: this.context() }, this.handler.origin);
        },
        onMessage(event) {
            if (event.origin !== this.handler.origin || event.source !== this.$refs.frame?.contentWindow) return;
            const msg = event.data || {};
            if (typeof msg.type !== 'string' || !msg.type.startsWith('pgpt:workitem:')) return;
            const kind = msg.type.slice('pgpt:workitem:'.length);
            if (kind === 'ready') return this.sendInit();
            if (kind === 'resize' && Number(msg.height) > 200) {
                this.height = Math.min(4000, Math.ceil(Number(msg.height)));
                return;
            }
            if (['values', 'save', 'submit'].includes(kind) && msg.values && typeof msg.values === 'object') {
                if (this.readonly && kind !== 'values') return;
                this.lastSync = new Date().toLocaleTimeString();
                this.$emit(kind, msg.values);
            }
        }
    }
};
</script>

<style scoped>
.app-workitem { border: 1px solid rgba(var(--v-border-color), 0.2); border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
.app-workitem-bar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; background: rgba(var(--v-theme-primary), 0.06); }
.app-name { font-weight: 600; }
.app-hint { color: rgba(var(--v-theme-on-surface), 0.6); }
.app-workitem-frame { width: 100%; border: 0; display: block; background: #fff; }
</style>
