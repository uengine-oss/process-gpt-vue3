<template>
    <div class="process-artifact">
        <div class="process-artifact__header">
            <div class="process-artifact__title">
                <v-icon size="18" class="mr-1">mdi-sitemap-outline</v-icon>
                <span>{{ processName }}</span>
            </div>
            <v-chip
                v-if="result.__saved"
                size="small"
                color="success"
                variant="flat"
                prepend-icon="mdi-check"
            >저장됨</v-chip>
        </div>

        <div class="process-artifact__summary">
            <div class="process-artifact__metric">
                <span class="process-artifact__metric-num">{{ elementCount }}</span>
                <span class="process-artifact__metric-label">요소</span>
            </div>
            <div class="process-artifact__metric">
                <span class="process-artifact__metric-num">{{ skills.length }}</span>
                <span class="process-artifact__metric-label">스킬</span>
            </div>
            <div class="process-artifact__metric">
                <span class="process-artifact__metric-num">{{ agents.length }}</span>
                <span class="process-artifact__metric-label">에이전트</span>
            </div>
            <div class="process-artifact__metric">
                <span class="process-artifact__metric-num">{{ forms.length }}</span>
                <span class="process-artifact__metric-label">폼</span>
            </div>
        </div>

        <div v-if="skills.length" class="process-artifact__section">
            <div class="process-artifact__section-title">스킬</div>
            <div v-for="(s, i) in skills" :key="'sk' + i" class="process-artifact__item">
                <v-icon size="13" class="mr-1">mdi-puzzle-outline</v-icon>{{ skillLabel(s) }}
            </div>
        </div>

        <div v-if="agents.length" class="process-artifact__section">
            <div class="process-artifact__section-title">에이전트</div>
            <div v-for="(a, i) in agents" :key="'ag' + i" class="process-artifact__item">
                <v-icon size="13" class="mr-1">mdi-account-outline</v-icon>{{ a.name || a.id }}
                <span v-if="a.role" class="process-artifact__muted"> · {{ a.role }}</span>
            </div>
        </div>

        <div class="process-artifact__actions">
            <v-btn
                size="small"
                variant="tonal"
                prepend-icon="mdi-eye-outline"
                @click="$emit('preview-bpmn', previewPayload)"
            >미리보기</v-btn>
            <v-btn
                size="small"
                color="primary"
                variant="flat"
                :loading="result.__saving"
                :disabled="result.__saved || !canSave"
                prepend-icon="mdi-content-save-outline"
                @click="$emit('save-generated-process', result)"
            >{{ result.__saved ? '저장됨' : '저장' }}</v-btn>
        </div>

        <div v-if="result.__saveError" class="process-artifact__error">
            <v-icon size="14" class="mr-1">mdi-alert-circle-outline</v-icon>{{ result.__saveError }}
        </div>
    </div>
</template>

<script>
export default {
    name: 'ProcessArtifactViewer',
    props: {
        // ChatRoomPage._mapPostprocessToPdf2bpmnResult 의 결과 객체(참조 공유 → __saved 갱신 반영)
        result: { type: Object, required: true }
    },
    emits: ['preview-bpmn', 'save-generated-process'],
    computed: {
        contract() {
            return (this.result && this.result.__contract) || null;
        },
        processDefinition() {
            return this.contract && this.contract.processDefinition ? this.contract.processDefinition : null;
        },
        processName() {
            const sp = this.result && this.result.savedProcesses && this.result.savedProcesses[0];
            if (sp && sp.process_name) return sp.process_name;
            const pd = this.processDefinition;
            return (pd && (pd.processDefinitionName || pd.name)) || '생성된 프로세스';
        },
        elementCount() {
            const pd = this.processDefinition;
            if (pd && Array.isArray(pd.elements)) return pd.elements.length;
            // flattened 호환
            if (pd) {
                return ['activities', 'events', 'gateways', 'sequences']
                    .reduce((n, k) => n + (Array.isArray(pd[k]) ? pd[k].length : 0), 0);
            }
            return 0;
        },
        skills() {
            return Array.isArray(this.result && this.result.savedSkills) ? this.result.savedSkills : [];
        },
        agents() {
            return Array.isArray(this.result && this.result.savedAgents) ? this.result.savedAgents : [];
        },
        forms() {
            return this.contract && Array.isArray(this.contract.forms) ? this.contract.forms : [];
        },
        canSave() {
            return !!(this.processDefinition);
        },
        previewPayload() {
            return {
                definition: this.processDefinition,
                __unsaved: !this.result.__saved,
                process_name: this.processName
            };
        }
    },
    methods: {
        skillLabel(s) {
            if (!s) return '';
            if (typeof s === 'string') return s;
            return s.name || s.label || s.safe_name || s.id || '';
        }
    }
};
</script>

<style scoped>
.process-artifact {
    padding: 14px 16px;
    height: 100%;
    overflow-y: auto;
    font-size: 13px;
}
.process-artifact__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
}
.process-artifact__title {
    display: flex;
    align-items: center;
    font-size: 15px;
    font-weight: 600;
    color: rgb(var(--v-theme-on-surface));
}
.process-artifact__summary {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
}
.process-artifact__metric {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    border-radius: 8px;
    background: rgba(var(--v-theme-on-surface), 0.04);
}
.process-artifact__metric-num {
    font-size: 18px;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
}
.process-artifact__metric-label {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.process-artifact__section {
    margin-bottom: 12px;
}
.process-artifact__section-title {
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin-bottom: 4px;
}
.process-artifact__item {
    display: flex;
    align-items: center;
    padding: 3px 0;
    color: rgba(var(--v-theme-on-surface), 0.85);
}
.process-artifact__muted {
    color: rgba(var(--v-theme-on-surface), 0.5);
}
.process-artifact__actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}
.process-artifact__error {
    display: flex;
    align-items: center;
    margin-top: 10px;
    color: rgb(var(--v-theme-error));
    font-size: 12px;
}
</style>
