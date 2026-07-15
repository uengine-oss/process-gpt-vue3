<template>
    <v-dialog :model-value="modelValue" max-width="640" @update:model-value="(val) => $emit('update:modelValue', val)">
        <div class="spr-card">
            <div class="spr-header">
                <div class="spr-header-main">
                    <span class="spr-header-icon"><v-icon size="16">mdi-lightning-bolt-outline</v-icon></span>
                    <div class="spr-header-text">
                        <div class="spr-title">{{ skillName }}</div>
                        <div class="spr-subtitle">{{ $t('SkillProposal.pendingCount', { count: localTargets.length, skillName }) }}</div>
                    </div>
                </div>
                <button type="button" class="spr-close" @click="$emit('update:modelValue', false)">
                    <v-icon size="16">mdi-close</v-icon>
                </button>
            </div>

            <div class="spr-body">
                <div v-if="localTargets.length === 0" class="spr-empty">
                    <v-icon size="28" class="spr-empty-icon">mdi-check-circle-outline</v-icon>
                    <div>{{ $t('SkillProposal.noProposalsHint') }}</div>
                </div>

                <div v-for="(item, index) in localTargets" :key="item.key" class="spr-item">
                    <div v-if="localTargets.length > 1" class="spr-item-label">
                        {{ $t('SkillProposal.itemLabel', { index: index + 1, total: localTargets.length }) }}
                    </div>

                    <div v-if="item.isHintMatch" class="spr-banner spr-banner-hint">
                        <v-icon size="14">mdi-help-circle-outline</v-icon>
                        <span>{{
                            item.hintCandidates && item.hintCandidates.length > 0
                                ? $t('SkillProposal.hintMatchWithCandidates', { skillNames: item.hintCandidates.join(', ') })
                                : $t('SkillProposal.hintMatch')
                        }}</span>
                    </div>
                    <div v-if="item.otherSkillNames && item.otherSkillNames.length > 0" class="spr-banner spr-banner-warn">
                        <v-icon size="14">mdi-alert-outline</v-icon>
                        <span>{{ $t('SkillProposal.sharedBatchWarning', { skillNames: item.otherSkillNames.join(', ') }) }}</span>
                    </div>
                    <div v-if="mismatchKey === item.key" class="spr-banner spr-banner-info">
                        <v-icon size="14">mdi-information-outline</v-icon>
                        <span>{{ $t('SkillProposal.decideMismatch') }}</span>
                    </div>

                    <div class="spr-artifact">{{ artifactText(item.artifact) }}</div>

                    <textarea
                        v-model="decisionNotes[item.key]"
                        class="spr-textarea"
                        :placeholder="$t('SkillProposal.decisionNoteLabel')"
                        rows="2"
                    ></textarea>

                    <div class="spr-actions">
                        <button type="button" class="spr-btn spr-btn-reject" :disabled="!!processingKey" @click="decide(item, 'REJECTED')">
                            <v-progress-circular v-if="processingKey === item.key" size="14" width="2" indeterminate />
                            <span v-else>{{ $t('SkillProposal.reject') }}</span>
                        </button>
                        <button type="button" class="spr-btn spr-btn-approve" :disabled="!!processingKey" @click="decide(item, 'APPROVED')">
                            <v-progress-circular v-if="processingKey === item.key" size="14" width="2" indeterminate color="white" />
                            <span v-else>{{ $t('SkillProposal.approve') }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </v-dialog>
</template>

<script>
export default {
    name: 'SkillProposalReviewModal',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        skillName: {
            type: String,
            default: ''
        },
        pendingTargets: {
            type: Array,
            default: () => []
        },
        backend: {
            type: Object,
            required: true
        },
        userInfo: {
            type: Object,
            default: null
        }
    },
    emits: ['update:modelValue', 'decided'],
    data() {
        return {
            localTargets: [...this.pendingTargets],
            processingKey: null,
            decisionNotes: {},
            mismatchKey: null
        };
    },
    watch: {
        pendingTargets: {
            handler(newVal) {
                this.localTargets = Array.isArray(newVal) ? [...newVal] : [];
            }
        }
    },
    methods: {
        artifactText(artifact) {
            if (typeof artifact === 'string') return artifact;
            try {
                return JSON.stringify(artifact, null, 2);
            } catch (e) {
                return String(artifact);
            }
        },
        async decide(item, status) {
            this.processingKey = item.key;
            this.mismatchKey = null;
            try {
                await this.backend.decideFeedbackProposalTarget({
                    batchId: item.batchId,
                    targetType: 'SKILL',
                    status,
                    decidedBy: this.userInfo?.uid,
                    decidedByName: this.userInfo?.name,
                    decidedByEmail: this.userInfo?.email,
                    decisionNote: this.decisionNotes[item.key]
                });

                // The approve/reject API only confirms that *a* PENDING target of this type was
                // decided, not which one — the underlying RPC resolves the first PENDING target of
                // the given type in array order, so when a batch has SKILL targets for multiple
                // skills (or even the same skill twice), this call may have resolved a different
                // target than the one the user clicked. Re-fetch and verify by exact array position
                // (targetIndex) rather than skill_name: targetIndex already uniquely identifies the
                // target, and skill_name may legitimately be absent when this item was matched via
                // the candidate_skill_names hint fallback (item.isHintMatch), so requiring equality
                // on it would misreport a correct decide as a mismatch.
                const batches = await this.backend.getPendingSkillProposalBatches(window.$tenantName);
                const updatedBatch = (batches || []).find((b) => b.id === item.batchId);
                // Not found means every target on the batch is now decided (it drops out of the
                // PROPOSED-only list) — nothing left to cross-check, so treat it as a success.
                if (updatedBatch) {
                    const targets = Array.isArray(updatedBatch.targets) ? updatedBatch.targets : [];
                    const decidedTarget = targets[item.targetIndex];
                    const decidedThisOne = decidedTarget && decidedTarget.type === 'SKILL' && decidedTarget.status === status;
                    if (!decidedThisOne) {
                        this.mismatchKey = item.key;
                        return;
                    }
                }

                this.localTargets = this.localTargets.filter((t) => t.key !== item.key);
                this.$emit('decided', { batchId: item.batchId, targetIndex: item.targetIndex, status });
                if (this.localTargets.length === 0) {
                    this.$emit('update:modelValue', false);
                }
            } catch (error) {
                if (error?.response?.status === 409) {
                    this.mismatchKey = item.key;
                } else {
                    console.error(this.$t('SkillProposal.decideFailed'), error);
                }
            } finally {
                this.processingKey = null;
            }
        }
    }
};
</script>

<style scoped>
.spr-card {
    background: rgb(var(--v-theme-surface));
    border-radius: 12px;
    overflow: hidden;
}

.spr-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 16px 14px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.spr-header-main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.spr-header-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(var(--v-theme-warning), 0.12);
    color: rgb(var(--v-theme-warning));
    flex: none;
}

.spr-header-text {
    min-width: 0;
}

.spr-title {
    font-size: 15px;
    font-weight: 700;
    color: rgba(var(--v-theme-on-surface), 0.87);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.spr-subtitle {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.5);
    margin-top: 2px;
}

.spr-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(var(--v-theme-on-surface), 0.5);
    cursor: pointer;
    flex: none;
    transition: background 0.12s;
}
.spr-close:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
}

.spr-body {
    max-height: 60vh;
    overflow-y: auto;
    padding: 14px 16px 16px;
}

.spr-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 36px 0;
    color: rgba(var(--v-theme-on-surface), 0.45);
    font-size: 13px;
}

.spr-empty-icon {
    color: rgba(var(--v-theme-on-surface), 0.25);
}

.spr-item {
    padding: 14px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 10px;
}
.spr-item + .spr-item {
    margin-top: 10px;
}

.spr-item-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.45);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
}

.spr-banner {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12.5px;
    line-height: 1.4;
    padding: 8px 10px;
    border-radius: 8px;
    margin-bottom: 10px;
}
.spr-banner-warn {
    background: #fbf0da;
    color: #92610a;
}
.spr-banner-info {
    background: rgba(var(--v-theme-info), 0.1);
    color: rgb(var(--v-theme-info));
}
.spr-banner-hint {
    background: rgba(var(--v-theme-on-surface), 0.06);
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.spr-artifact {
    font-size: 13.5px;
    line-height: 1.6;
    color: rgba(var(--v-theme-on-surface), 0.8);
    white-space: pre-wrap;
    background: rgba(var(--v-theme-on-surface), 0.03);
    border-radius: 8px;
    padding: 10px 12px;
}

.spr-textarea {
    width: 100%;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 10px;
    margin-top: 10px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    resize: vertical;
    outline: none;
    background: transparent;
    color: rgba(var(--v-theme-on-surface), 0.87);
    transition: border-color 0.12s;
}
.spr-textarea:focus {
    border-color: rgb(var(--v-theme-primary));
}
.spr-textarea::placeholder {
    color: rgba(var(--v-theme-on-surface), 0.35);
}

.spr-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
}

.spr-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 68px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    padding: 6px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.12s, background 0.12s;
}
.spr-btn:disabled {
    opacity: 0.5;
    cursor: default;
}

.spr-btn-reject {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: transparent;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.spr-btn-reject:hover:not(:disabled) {
    background: rgba(var(--v-theme-error), 0.06);
    color: rgb(var(--v-theme-error));
}

.spr-btn-approve {
    border: none;
    background: #3e9a3e;
    color: #fff;
}
.spr-btn-approve:hover:not(:disabled) {
    background: #358a35;
}
</style>
