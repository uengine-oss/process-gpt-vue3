<template>
    <div class="skill-git-history d-flex flex-column h-100">
        <div class="d-flex align-center justify-space-between px-4 py-3 flex-shrink-0">
            <div class="d-flex align-center gap-2">
                <v-icon size="20" color="primary">mdi-source-branch</v-icon>
                <span class="text-subtitle-1 font-weight-medium">Git 변경 이력</span>
                <span v-if="repoName" class="text-caption text-medium-emphasis">— {{ repoName }}</span>
            </div>
        </div>

        <v-divider />

        <div class="flex-grow-1 overflow-y-auto">
            <!-- 빈 목록 -->
            <div v-if="commits.length === 0" class="d-flex flex-column align-center justify-center py-8">
                <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-history</v-icon>
                <div class="text-body-2 text-medium-emphasis">변경 이력이 없습니다.</div>
            </div>

            <!-- 커밋 목록 -->
            <v-timeline v-else density="compact" side="end" class="commit-timeline px-3 py-4">
                <v-timeline-item
                    v-for="commit in commits"
                    :key="commit.sha"
                    size="x-small"
                    dot-color="primary"
                    class="commit-item"
                >
                    <template #opposite>
                        <div class="text-caption text-medium-emphasis commit-date">
                            {{ formatDate(commit.commit.author.date) }}
                        </div>
                    </template>
                    <v-card variant="outlined" class="commit-card" :href="commit.html_url" target="_blank" rel="noopener noreferrer">
                        <div class="d-flex align-start pa-3 gap-3">
                            <v-avatar size="28" class="flex-shrink-0 mt-1">
                                <img
                                    v-if="commit.author && commit.author.avatar_url"
                                    :src="commit.author.avatar_url"
                                    :alt="commit.commit.author.name"
                                />
                                <v-icon v-else size="20">mdi-account-circle-outline</v-icon>
                            </v-avatar>
                            <div class="flex-grow-1 min-w-0">
                                <div class="text-body-2 font-weight-medium commit-message">
                                    {{ firstLine(commit.commit.message) }}
                                </div>
                                <div v-if="bodyLines(commit.commit.message)" class="text-caption text-medium-emphasis mt-1 commit-body">
                                    {{ bodyLines(commit.commit.message) }}
                                </div>
                                <div class="d-flex align-center gap-2 mt-1 flex-wrap">
                                    <span class="text-caption text-medium-emphasis">{{ commit.commit.author.name }}</span>
                                    <v-chip
                                        size="x-small"
                                        variant="tonal"
                                        color="default"
                                        class="font-mono commit-sha"
                                    >
                                        {{ commit.sha.slice(0, 7) }}
                                    </v-chip>
                                </div>
                            </div>
                            <v-icon size="14" class="text-medium-emphasis flex-shrink-0 mt-1">mdi-open-in-new</v-icon>
                        </div>
                    </v-card>
                </v-timeline-item>
            </v-timeline>
        </div>
    </div>
</template>

<script>
export default {
    name: 'SkillGitHistory',
    props: {
        skillName: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            commits: []
        };
    },
    computed: {
        repoName() {
            return this.skillName || '';
        }
    },
    methods: {
        formatDate(dateString) {
            if (!dateString) return '';
            try {
                return new Date(dateString).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return dateString;
            }
        },

        firstLine(message) {
            return (message || '').split('\n')[0].trim();
        },

        bodyLines(message) {
            const lines = (message || '').split('\n').slice(1).join('\n').trim();
            return lines.length > 120 ? lines.slice(0, 120) + '…' : lines;
        }
    }
};
</script>

<style scoped>
.skill-git-history {
    height: 100%;
    overflow: hidden;
}

.commit-timeline {
    width: 100%;
}

.commit-card {
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s;
}

.commit-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
}

.commit-message {
    word-break: break-word;
    line-height: 1.4;
}

.commit-body {
    white-space: pre-line;
    word-break: break-word;
    max-height: 60px;
    overflow: hidden;
}

.commit-sha {
    font-family: 'Courier New', monospace;
    font-size: 11px;
}

.commit-date {
    min-width: 110px;
    text-align: right;
    font-size: 11px;
}

.font-mono {
    font-family: 'Courier New', monospace;
}

.min-w-0 {
    min-width: 0;
}
</style>
