<template>
    <div class="app-workitem">
        <div class="app-workitem-bar">
            <v-icon size="16" class="mr-1">mdi-application-brackets-outline</v-icon>
            <span class="app-name">{{ handler.name }}</span>
            <span class="app-hint">{{ readonly ? '조회 · 업무 시스템 화면' : '업무 시스템 화면에서 확인·수정 후 저장·제출' }}</span>
            <v-spacer></v-spacer>
            <span v-if="protocol >= 2" class="app-hint">protocol {{ protocol }}{{ port ? ' · 전용 채널' : '' }}</span>
            <span v-if="lastSync" class="app-hint">· {{ lastSync }}</span>
        </div>
        <iframe ref="frame" :src="handler.url" class="app-workitem-frame" :style="{ height: height + 'px' }" @load="onLoad"></iframe>
    </div>
</template>

<script>
/**
 * 외부 앱 화면을 워크아이템으로 임베드한다 — postMessage 계약 (protocol 1 · 2)
 *
 * 원칙: Process GPT 는 업무 데이터를 직접 쓰지 않는다. 에이전트가 만든 값은 업무 화면에 '채워 넣기(fill)'만 하고
 *       (저장 전 초안), 업무 데이터 저장은 업무 화면 자신의 저장으로만 일어난다(사람이 누르거나 save-request 에 응답).
 *
 * 공통 (protocol 1)
 *   PGPT → 앱  pgpt:workitem:init { protocol, capabilities, workitem }
 *   앱 → PGPT  pgpt:workitem:ready { protocol?, accepts?, channel? }   init 요청(+ 기능 협상)
 *              pgpt:workitem:values { values }                          폼 값(데이터 계약)에 병합
 *              pgpt:workitem:save   { values, requestId? }              병합 후 중간 저장
 *              pgpt:workitem:submit { values, requestId? }              병합 후 제출 완료
 *              pgpt:workitem:resize { height }
 * protocol 2 (앱이 ready 에 accepts 로 밝힌 것만 보낸다)
 *   PGPT → 앱  pgpt:workitem:fill   { values, source: 'agent'|'form', draft: true }   저장 전 초안 — 앱은 저장하지 않는다
 *              pgpt:workitem:update { status, readonly }                             워크아이템 상태 변화
 *              pgpt:workitem:save-request { requestId }                              제출 전에 업무 화면 저장을 요청
 *              pgpt:workitem:ack    { requestId, ok, stage, error? }                 앱의 save/submit 처리 결과
 *   앱 → PGPT  pgpt:workitem:saved  { requestId, ok, values?, error? }               save-request 응답
 *   channel: true 이면 init 과 함께 MessagePort 를 넘기고, 이후 메시지는 그 전용 채널로만 주고받는다.
 */
const PREFIX = 'pgpt:workitem:';
const SUPPORTED = ['fill', 'update', 'save-request', 'ack'];

export default {
    name: 'AppWorkItemFrame',
    props: {
        handler: { type: Object, required: true },
        workItem: { type: Object, required: true },
        formId: { type: String, default: '' },
        values: { type: Object, default: () => ({}) },
        /** 마지막으로 폼 값을 바꾼 주체: 'agent'(에이전트 초안) | 'form'(사람이 폼에서) | 'app'(이 화면이 보낸 값) */
        valuesSource: { type: String, default: 'form' },
        readonly: { type: Boolean, default: false },
        status: { type: String, default: '' }
    },
    emits: ['values', 'save', 'submit'],
    data: () => ({ height: 760, lastSync: '', protocol: 1, accepts: [], port: null, pending: {}, fillTimer: null }),
    mounted() {
        window.addEventListener('message', this.onWindowMessage);
    },
    beforeUnmount() {
        window.removeEventListener('message', this.onWindowMessage);
        if (this.port) this.port.close();
        Object.values(this.pending).forEach((p) => p.resolve({ ok: false, error: 'closed' }));
        clearTimeout(this.fillTimer);
    },
    watch: {
        readonly() {
            this.pushState();
        },
        status() {
            this.pushState();
        },
        values: {
            deep: true,
            handler() {
                // 이 화면이 보낸 값이 되돌아온 것이면 다시 보내지 않는다
                if (this.valuesSource === 'app' || !this.accepts.includes('fill')) return;
                clearTimeout(this.fillTimer);
                this.fillTimer = setTimeout(() => this.send({ type: PREFIX + 'fill', values: this.snapshot(), source: this.valuesSource, draft: true }), 300);
            }
        }
    },
    methods: {
        snapshot() {
            return JSON.parse(JSON.stringify(this.values || {}));
        },
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
                status: this.status || wl.status || '',
                readonly: this.readonly,
                values: this.snapshot(),
                user: { email: localStorage.getItem('email') || '', name: localStorage.getItem('userName') || '' }
            };
        },
        win() {
            return this.$refs.frame?.contentWindow || null;
        },
        send(msg) {
            if (this.port) this.port.postMessage(msg);
            else if (this.win()) this.win().postMessage(msg, this.handler.origin);
        },
        sendInit(transfer = false) {
            const w = this.win();
            if (!w) return;
            const msg = { type: PREFIX + 'init', protocol: this.protocol, capabilities: SUPPORTED, workitem: this.context() };
            if (transfer) {
                if (this.port) this.port.close();
                const ch = new MessageChannel();
                this.port = ch.port1;
                this.port.onmessage = (e) => this.handle(e.data || {});
                w.postMessage({ ...msg, channel: true }, this.handler.origin, [ch.port2]);
            } else {
                this.send(msg);
            }
        },
        onLoad() {
            // 앱은 보통 load 이벤트보다 먼저 ready 를 보낸다 — 이미 협상했으면 건드리지 않는다.
            // ready 를 보내지 않는 protocol 1 앱은 이 init 만 받는다. 새 문서는 ready 를 다시 보내 협상을 새로 한다.
            if (!this.port && this.protocol === 1) this.sendInit(false);
        },
        pushState() {
            if (this.protocol >= 2 && this.accepts.includes('update')) {
                this.send({ type: PREFIX + 'update', status: this.status || this.workItem?.worklist?.status || '', readonly: this.readonly });
            } else {
                this.sendInit(false);
            }
        },
        /** 제출 전에 업무 화면에 저장을 요청한다. 앱이 save-request 를 받지 않으면 바로 ok. */
        requestSave(timeoutMs = 30000) {
            if (!(this.protocol >= 2 && this.accepts.includes('save-request'))) return Promise.resolve({ ok: true, skipped: true });
            const requestId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    delete this.pending[requestId];
                    resolve({ ok: false, error: '업무 화면이 저장 요청에 응답하지 않았습니다.' });
                }, timeoutMs);
                this.pending[requestId] = { resolve: (r) => { clearTimeout(timer); resolve(r); } };
                this.send({ type: PREFIX + 'save-request', requestId });
            });
        },
        ack(requestId, ok, stage, error) {
            if (requestId && this.protocol >= 2) this.send({ type: PREFIX + 'ack', requestId, ok, stage, ...(error ? { error } : {}) });
        },
        onWindowMessage(event) {
            if (event.origin !== this.handler.origin || event.source !== this.win()) return;
            this.handle(event.data || {});
        },
        handle(msg) {
            if (typeof msg.type !== 'string' || !msg.type.startsWith(PREFIX)) return;
            const kind = msg.type.slice(PREFIX.length);
            if (kind === 'ready') {
                const p = Number(msg.protocol) || 1;
                this.protocol = Math.min(2, Math.max(1, p));
                this.accepts = this.protocol >= 2 && Array.isArray(msg.accepts) ? msg.accepts.filter((a) => SUPPORTED.includes(a)) : [];
                return this.sendInit(this.protocol >= 2 && !!msg.channel);
            }
            if (kind === 'resize' && Number(msg.height) > 200) {
                this.height = Math.min(4000, Math.ceil(Number(msg.height)));
                return;
            }
            if (kind === 'saved') {
                const p = this.pending[msg.requestId];
                if (p) {
                    delete this.pending[msg.requestId];
                    p.resolve({ ok: !!msg.ok, values: msg.values, error: msg.error });
                }
                return;
            }
            if (['values', 'save', 'submit'].includes(kind) && msg.values && typeof msg.values === 'object') {
                if (this.readonly && kind !== 'values') return this.ack(msg.requestId, false, kind, 'readonly');
                this.lastSync = new Date().toLocaleTimeString();
                const done = (ok, stage, error) => this.ack(msg.requestId, ok, stage || kind, error);
                this.$emit(kind, msg.values, done);
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
