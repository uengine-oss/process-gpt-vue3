<template>
    <div class="pfd">
        <v-card elevation="0" class="pfd-card">
            <div class="pfd-title">문서로 프로세스 만들기</div>
            <div class="pfd-sub">{{ source ? `${sourceName || '외부 시스템'}에서 넘어온 문서를 프로세스 생성으로 보냅니다.` : '문서 주소가 없습니다.' }}</div>
            <v-alert v-if="error" type="error" density="compact" class="mt-3">{{ error }}</v-alert>
            <template v-else-if="doc">
                <div class="pfd-meta">{{ title }} · {{ doc.length.toLocaleString() }}자</div>
                <pre class="pfd-doc">{{ doc }}</pre>
                <div class="pfd-actions">
                    <v-btn variant="text" @click="$router.back()">취소</v-btn>
                    <v-btn color="primary" variant="flat" :loading="sending" @click="start">이 문서로 프로세스 생성</v-btn>
                </div>
            </template>
            <div v-else-if="source" class="pfd-sub mt-3">문서를 불러오는 중…</div>
        </v-card>
    </div>
</template>

<script>
/**
 * 외부 시스템 → 문서 기반 프로세스 생성 핸드오프.
 *
 *   /process-from-document?source=<같은 출처의 문서 경로>&title=<프로세스 이름>&from=<보낸 시스템 이름>[&auto=1]
 *
 * 문서(마크다운·텍스트)를 같은 출처에서만 읽어 생성 대화방을 만들고, 프로세스 생성 스킬이 바로 시작되게 한다
 * (/chat?roomId=…&autosend=1). Process GPT 는 문서를 보낸 시스템을 알 필요가 없다.
 */
export default {
    name: 'ProcessFromDocument',
    data: () => ({ doc: '', error: '', sending: false }),
    computed: {
        source() {
            return String(this.$route.query.source || '');
        },
        title() {
            return String(this.$route.query.title || '업무 프로세스');
        },
        sourceName() {
            return String(this.$route.query.from || '');
        },
        tenantId() {
            return window.$tenantName || 'localhost';
        }
    },
    async mounted() {
        if (!this.source) return;
        try {
            const url = new URL(this.source, window.location.origin);
            if (url.origin !== window.location.origin) throw new Error('같은 출처의 문서만 받을 수 있습니다.');
            const r = await fetch(url.toString(), { credentials: 'same-origin' });
            if (!r.ok) throw new Error(`문서를 읽지 못했습니다 (${r.status})`);
            this.doc = (await r.text()).slice(0, 60000);
            if (this.$route.query.auto === '1') await this.start();
        } catch (e) {
            this.error = e?.message || String(e);
        }
    },
    methods: {
        request() {
            return (
                `"${this.title}" 프로세스를 생성해줘. 첨부 파일은 없다 — 아래에 업무 절차서 전문을 그대로 붙여 넣었으니 이 붙여 넣은 텍스트를 문서로 보고 흐름을 추출해줘. ` +
                `이 절차서는 ${this.sourceName || '외부 업무 시스템'}에서 실제 업무 수행 이력(이벤트)과 담당자 설명으로 작성됐다. ` +
                `역할·절차 순서·업무 규칙·사람에게 넘기는 예외 조건을 그대로 반영하고, 프로세스 이름은 "${this.title}" 로 한다.\n\n` +
                `===== 업무 절차서 (붙여 넣은 문서) =====\n${this.doc}\n===== 끝 =====`
            );
        },
        async start() {
            this.sending = true;
            try {
                const roomId = crypto.randomUUID();
                const me = {
                    id: localStorage.getItem('uid'),
                    email: localStorage.getItem('email'),
                    username: localStorage.getItem('userName') || 'demo',
                    profile: '/assets/images/profile/user-3.jpg',
                    is_agent: null,
                    agent_type: null
                };
                const agent = { id: 'process-gpt-agent', email: null, username: 'Process GPT Agent', profile: '/images/chat-icon.png', is_agent: true, agent_type: 'agent' };
                const { error: roomErr } = await window.$supabase.from('chat_rooms').insert({
                    id: roomId,
                    tenant_id: this.tenantId,
                    name: `${this.title} 프로세스 생성`,
                    participants: [me, agent],
                    message: { msg: 'NEW', type: 'text', createdAt: new Date().toISOString() },
                    context: { orchestration: 'deepagents', identification: { source: 'process-from-document', from: this.sourceName, document: this.source } }
                });
                if (roomErr) throw new Error(`대화방 생성 실패: ${roomErr.message}`);
                const { error: msgErr } = await window.$supabase.from('chats').insert({
                    uuid: crypto.randomUUID(),
                    id: roomId,
                    tenant_id: this.tenantId,
                    messages: { role: 'user', name: me.username, email: me.email || '', content: this.request(), timeStamp: new Date().toISOString() }
                });
                if (msgErr) throw new Error(`요청문 저장 실패: ${msgErr.message}`);
                this.$router.push(`/chat?roomId=${roomId}&autosend=1`);
            } catch (e) {
                this.error = e?.message || String(e);
            } finally {
                this.sending = false;
            }
        }
    }
};
</script>

<style scoped>
.pfd { padding: 24px; display: flex; justify-content: center; }
.pfd-card { width: 100%; max-width: 980px; padding: 24px; border: 1px solid rgba(var(--v-border-color), 0.2); border-radius: 16px; }
.pfd-title { font-size: 20px; font-weight: 700; }
.pfd-sub { color: rgba(var(--v-theme-on-surface), 0.65); margin-top: 4px; }
.pfd-meta { margin: 16px 0 8px; font-weight: 600; }
.pfd-doc { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.6; max-height: 60vh; overflow: auto; background: rgba(var(--v-theme-primary), 0.04); border-radius: 10px; padding: 14px 16px; }
.pfd-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
</style>
