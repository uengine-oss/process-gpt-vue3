<template>
    <v-dialog :model-value="modelValue" persistent max-width="620px" @update:model-value="onDialogModel">
        <v-card>
            <v-card-title class="d-flex justify-space-between pa-4 pb-2">
                <div class="d-flex align-center">
                    {{ $t('processComponent.importPreviewTitle') || '컴포넌트 가져오기 미리보기' }}
                </div>
                <v-btn @click="cancel" variant="text" density="compact" icon>
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pa-4 pt-2">
                <div v-if="loading" class="d-flex align-center justify-center py-8">
                    <v-progress-circular indeterminate color="primary" />
                </div>
                <div v-else-if="error" class="text-error py-4">{{ error }}</div>
                <div v-else-if="preview">
                    <div class="d-flex align-center mb-2">
                        <span class="text-h6">{{ preview.manifest.name }}</span>
                        <v-chip size="x-small" color="secondary" variant="tonal" class="ml-2"> v{{ preview.manifest.version }} </v-chip>
                    </div>
                    <div class="text-body-2 text-medium-emphasis mb-3">
                        {{ preview.manifest.description }}
                    </div>

                    <v-row dense class="mb-2">
                        <v-col cols="3">
                            <div class="stat-tile">
                                <div class="text-h6">{{ preview.formCount }}</div>
                                <div class="text-caption">{{ $t('processComponent.forms') || '폼' }}</div>
                            </div>
                        </v-col>
                        <v-col cols="3">
                            <div class="stat-tile">
                                <div class="text-h6">{{ preview.agentCount }}</div>
                                <div class="text-caption">{{ $t('processComponent.agents') || '에이전트' }}</div>
                            </div>
                        </v-col>
                        <v-col cols="3">
                            <div class="stat-tile">
                                <div class="text-h6">{{ preview.skillCount }}</div>
                                <div class="text-caption">{{ $t('processComponent.skills') || '스킬' }}</div>
                            </div>
                        </v-col>
                        <v-col cols="3">
                            <div class="stat-tile">
                                <div class="text-h6">{{ collisionDetected ? '↻' : '＋' }}</div>
                                <div class="text-caption">
                                    {{
                                        collisionDetected ? $t('processComponent.existing') || '기존' : $t('processComponent.new') || '신규'
                                    }}
                                </div>
                            </div>
                        </v-col>
                    </v-row>

                    <!-- 외부 툴 경고 -->
                    <v-alert
                        v-if="preview.externalTools && preview.externalTools.length"
                        type="info"
                        variant="tonal"
                        density="compact"
                        class="mb-2"
                    >
                        {{
                            $t('processComponent.externalToolsWarning') ||
                            '아래 외부 툴은 패키지에 포함되지 않습니다. 대상 테넌트에 존재해야 합니다:'
                        }}
                        <div class="mt-1">
                            <v-chip v-for="t in preview.externalTools" :key="t" size="x-small" class="mr-1 mb-1">{{ t }}</v-chip>
                        </div>
                    </v-alert>

                    <!-- SKILL.md 누락 경고 -->
                    <v-alert
                        v-if="preview.skillsMissingSkillMd && preview.skillsMissingSkillMd.length"
                        type="warning"
                        variant="tonal"
                        density="compact"
                        class="mb-2"
                    >
                        {{ $t('processComponent.skillMissingWarning') || 'SKILL.md 가 없는 스킬(설치에서 제외될 수 있음):' }}
                        {{ preview.skillsMissingSkillMd.join(', ') }}
                    </v-alert>

                    <!-- 충돌 처리 -->
                    <v-alert v-if="collisionDetected" type="warning" variant="tonal" density="compact" class="mb-2">
                        {{ $t('processComponent.collisionWarning') || '동일한 컴포넌트 ID가 이미 존재합니다.' }}
                    </v-alert>

                    <!-- 에이전트 처리 -->
                    <div v-if="preview.agents && preview.agents.length" class="mt-3">
                        <div class="text-subtitle-2 mb-1">{{ $t('processComponent.agentHandling') || '에이전트 처리' }}</div>
                        <v-list density="compact" class="pa-0">
                            <v-list-item v-for="(ag, i) in preview.agents" :key="i" class="px-2">
                                <template v-slot:prepend>
                                    <v-icon size="18" class="mr-2">mdi-robot-outline</v-icon>
                                </template>
                                <v-list-item-title class="text-body-2">
                                    {{ ag.username }} <span class="text-medium-emphasis">({{ ag.role || '-' }})</span>
                                </v-list-item-title>
                                <template v-slot:append>
                                    <v-btn-toggle v-model="agentActions[i]" density="compact" variant="outlined" divided mandatory>
                                        <v-btn size="x-small" value="create">{{
                                            $t('processComponent.agentCreate') || '생성/재사용'
                                        }}</v-btn>
                                        <v-btn size="x-small" value="skip">{{ $t('processComponent.agentSkip') || '제외' }}</v-btn>
                                    </v-btn-toggle>
                                </template>
                            </v-list-item>
                        </v-list>
                    </div>
                </div>
            </v-card-text>

            <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="text" @click="cancel">{{ $t('common.cancel') || '취소' }}</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    rounded
                    :disabled="!preview || loading || installing"
                    :loading="installing"
                    @click="confirm"
                >
                    {{ $t('processComponent.install') || '설치' }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'ProcessComponentImportDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        // 가져올 패키지 zip (ArrayBuffer). modelValue=true 로 열릴 때 파싱한다.
        zipData: { type: [ArrayBuffer, Uint8Array], default: null }
    },
    emits: ['update:modelValue', 'imported', 'cancel'],
    data: () => ({
        loading: false,
        installing: false,
        error: '',
        preview: null,
        collisionDetected: false,
        agentActions: []
    }),
    watch: {
        modelValue(val) {
            if (val && this.zipData) {
                this.buildPreview();
            } else if (!val) {
                this.reset();
            }
        }
    },
    methods: {
        reset() {
            this.preview = null;
            this.error = '';
            this.collisionDetected = false;
            this.agentActions = [];
        },
        onDialogModel(val) {
            if (!val) this.cancel();
        },
        async buildPreview() {
            this.loading = true;
            this.error = '';
            try {
                const { parsePackage, buildImportPreview } = await import('@/utils/processComponentPackage');
                const parsed = await parsePackage(this.zipData);
                this.preview = buildImportPreview(parsed);
                this.agentActions = (this.preview.agents || []).map(() => 'create');
                // 충돌 감지: 동일 componentId 의 proc_def 존재 여부
                this.collisionDetected = await backend.hasProcessDefinition(this.preview.manifest.componentId);
            } catch (e) {
                this.error = e?.message || String(e);
            } finally {
                this.loading = false;
            }
        },
        async confirm() {
            if (!this.preview) return;
            this.installing = true;
            try {
                // 'skip' 으로 표시된 역할을 agentMapping 으로 전달.
                const agentMapping = {};
                (this.preview.agents || []).forEach((ag, i) => {
                    const key = (ag.role || ag.username || '').toLowerCase();
                    if (key) agentMapping[key] = { action: this.agentActions[i] || 'create' };
                });
                const report = await backend.importProcessComponent(this.zipData, {
                    mode: 'install',
                    agentMapping
                });
                this.$emit('imported', report);
                this.$emit('update:modelValue', false);
                this.reset();
            } catch (e) {
                this.error = e?.message || String(e);
            } finally {
                this.installing = false;
            }
        },
        cancel() {
            this.$emit('cancel');
            this.$emit('update:modelValue', false);
            this.reset();
        }
    }
};
</script>

<style scoped>
.stat-tile {
    text-align: center;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    padding: 8px 4px;
}
</style>
