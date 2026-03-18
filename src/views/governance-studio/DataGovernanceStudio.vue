<script setup lang="ts">
import { computed, ref } from 'vue';

type TermItem = { label: string; count: number };
type Cluster = { id: string; suggested: string; confidence: number; terms: TermItem[]; status: 'pending' | 'approved' | 'rejected' };
type Pattern = {
    id: string;
    name: string;
    similarity: number;
    etomL3: string;
    centers: { a: number; b: number };
    variants: string[];
    status: 'pending' | 'approved' | 'rejected';
};
type DictionaryRow = { standardTerm: string; synonyms: string[]; owner: string; updatedAt: string };

const analysisRunning = ref(false);
const lastAnalyzedAt = ref('2026-03-16 23:10');
const schedule = ref('야간 배치 (02:00)');

const clusters = ref<Cluster[]>([
    {
        id: 'c1',
        suggested: '장애 조치',
        confidence: 0.92,
        terms: [
            { label: '고장 수리', count: 150 },
            { label: '알람 대응', count: 80 },
            { label: '트러블 처리', count: 57 }
        ],
        status: 'pending'
    },
    {
        id: 'c2',
        suggested: '고객 본인 인증',
        confidence: 0.88,
        terms: [
            { label: '사용자 확인', count: 91 },
            { label: '신분증 인증', count: 46 },
            { label: '본인확인', count: 41 }
        ],
        status: 'pending'
    }
]);

const patterns = ref<Pattern[]>([
    {
        id: 'p1',
        name: '장애 대응 시퀀스',
        similarity: 0.85,
        etomL3: 'Assurance > Trouble Management',
        centers: { a: 60, b: 40 },
        variants: ['알람 인지 -> 장비 리셋', '고장 접수 -> 선로 테스트 -> 보드 초기화'],
        status: 'pending'
    },
    {
        id: 'p2',
        name: '개통 후 검증 시퀀스',
        similarity: 0.81,
        etomL3: 'Fulfillment > Service Activation',
        centers: { a: 54, b: 46 },
        variants: ['개통 확인 -> 품질 점검 -> 완료 통보', '서비스 활성화 -> 회선 확인 -> 고객 통지'],
        status: 'pending'
    }
]);

const selectedClusterId = ref('c1');
const selectedPatternId = ref('p1');
const blacklistInput = ref('');
const blacklist = ref<string[]>(['임시점검', '기타처리']);

const impactSummary = ref({
    affectedCanvas: 245,
    possibleLoss: ['FTE 매핑 2건', 'OSS 속성 누락 1건'],
    rollbackReady: true
});

const dictionary = ref<DictionaryRow[]>([
    {
        standardTerm: '장애 조치',
        synonyms: ['고장 수리', '알람 대응', '트러블 처리'],
        owner: 'EA팀',
        updatedAt: '2026-03-16'
    },
    {
        standardTerm: '고객 본인 인증',
        synonyms: ['사용자 확인', '본인확인', '신분증 인증'],
        owner: 'PI실',
        updatedAt: '2026-03-15'
    }
]);

const uploadedPolicies = ref([
    { name: 'TMF_Operational_Compliance.pdf', status: '룰셋 변환 완료' },
    { name: 'Security_Audit_Guideline.csv', status: '검토 대기' }
]);

const selectedCluster = computed(() => clusters.value.find((c) => c.id === selectedClusterId.value));
const selectedPattern = computed(() => patterns.value.find((p) => p.id === selectedPatternId.value));
const pendingCount = computed(
    () => clusters.value.filter((c) => c.status === 'pending').length + patterns.value.filter((p) => p.status === 'pending').length
);

async function runAnalysis() {
    analysisRunning.value = true;
    await new Promise((resolve) => setTimeout(resolve, 700));
    lastAnalyzedAt.value = new Date().toLocaleString('ko-KR', { hour12: false });
    analysisRunning.value = false;
}

function setClusterStatus(id: string, status: Cluster['status']) {
    const target = clusters.value.find((c) => c.id === id);
    if (!target) return;
    target.status = status;
}

function setPatternStatus(id: string, status: Pattern['status']) {
    const target = patterns.value.find((p) => p.id === id);
    if (!target) return;
    target.status = status;
}

function addBlacklist() {
    const value = blacklistInput.value.trim();
    if (!value || blacklist.value.includes(value)) return;
    blacklist.value.unshift(value);
    blacklistInput.value = '';
}

function removeBlacklist(term: string) {
    blacklist.value = blacklist.value.filter((item) => item !== term);
}

function bulkMergeAndRegister() {
    clusters.value.forEach((c) => {
        if (c.status === 'pending') c.status = 'approved';
    });
    patterns.value.forEach((p) => {
        if (p.status === 'pending') p.status = 'approved';
    });
}
</script>

<template>
    <v-card elevation="0" class="governance-page">
        <v-card-text class="pa-6">
            <div class="d-flex align-start justify-space-between flex-wrap ga-3 mb-4">
                <div>
                    <h2 class="text-h5 font-weight-bold mb-1">데이터 거버넌스 스튜디오</h2>
                    <p class="text-body-2 text-medium-emphasis mb-0">
                        용어 정규화, 패턴 모듈화, 감사 룰셋 관리를 통해 전사 자동화 재사용성을 확보합니다.
                    </p>
                </div>
                <div class="d-flex align-center ga-2">
                    <v-select v-model="schedule" :items="['수동 실행', '야간 배치 (02:00)', '주간 배치 (일요일)']" hide-details density="compact" variant="outlined" style="min-width: 180px" />
                    <v-btn color="primary" :loading="analysisRunning" @click="runAnalysis">분석 실행</v-btn>
                </div>
            </div>

            <v-alert type="info" variant="tonal" border="start" class="mb-5">
                최근 분석 시각: <strong>{{ lastAnalyzedAt }}</strong> · 검토 대기 항목: <strong>{{ pendingCount }}건</strong>
            </v-alert>

            <v-row>
                <v-col cols="12" lg="7">
                    <v-card variant="outlined" class="mb-4">
                        <v-card-title class="d-flex align-center justify-space-between">
                            <span>모듈 1: LLM 기반 용어 클러스터링</span>
                            <v-chip size="small" color="primary" variant="tonal">Semantic Analysis</v-chip>
                        </v-card-title>
                        <v-card-text>
                            <v-row>
                                <v-col v-for="cluster in clusters" :key="cluster.id" cols="12" md="6">
                                    <v-card variant="tonal" :color="cluster.id === selectedClusterId ? 'primary' : 'grey'" class="cluster-card" @click="selectedClusterId = cluster.id">
                                        <v-card-text>
                                            <div class="d-flex justify-space-between align-center mb-2">
                                                <div class="font-weight-bold">추천 표준어: {{ cluster.suggested }}</div>
                                                <v-chip size="x-small" :color="cluster.status === 'approved' ? 'success' : cluster.status === 'rejected' ? 'error' : 'warning'">
                                                    {{ cluster.status }}
                                                </v-chip>
                                            </div>
                                            <div class="text-caption text-medium-emphasis mb-2">신뢰도 {{ Math.round(cluster.confidence * 100) }}%</div>
                                            <div v-for="term in cluster.terms" :key="term.label" class="d-flex justify-space-between text-body-2">
                                                <span>{{ term.label }}</span>
                                                <strong>{{ term.count }}건</strong>
                                            </div>
                                        </v-card-text>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>

                    <v-card variant="outlined" class="mb-4">
                        <v-card-title class="d-flex align-center justify-space-between">
                            <span>모듈 2: 패턴 발견 및 Baseline 모듈화</span>
                            <v-chip size="small" color="deep-purple" variant="tonal">Fuzzy Sequence</v-chip>
                        </v-card-title>
                        <v-card-text>
                            <v-list class="pa-0">
                                <v-list-item
                                    v-for="pattern in patterns"
                                    :key="pattern.id"
                                    :active="pattern.id === selectedPatternId"
                                    rounded="lg"
                                    class="mb-2 border-sm"
                                    @click="selectedPatternId = pattern.id"
                                >
                                    <template #title>
                                        <div class="d-flex align-center justify-space-between">
                                            <span class="font-weight-medium">{{ pattern.name }}</span>
                                            <v-chip size="x-small" color="primary">{{ Math.round(pattern.similarity * 100) }}% 유사</v-chip>
                                        </div>
                                    </template>
                                    <template #subtitle>
                                        <div class="mt-1">{{ pattern.etomL3 }} · A센터 {{ pattern.centers.a }}% / B센터 {{ pattern.centers.b }}%</div>
                                    </template>
                                </v-list-item>
                            </v-list>
                            <v-alert type="warning" variant="tonal" density="comfortable">
                                eTOM L3 경계를 넘는 시퀀스는 병합 대상에서 자동 제외됩니다.
                            </v-alert>
                        </v-card-text>
                    </v-card>

                    <v-card variant="outlined">
                        <v-card-title>모듈 3: Human-in-the-Loop 검토 및 일괄 반영</v-card-title>
                        <v-card-text>
                            <div class="text-subtitle-2 mb-2">사전 영향도 분석</div>
                            <v-sheet rounded="lg" class="pa-3 impact-sheet mb-3">
                                <div class="text-body-2">영향 캔버스: <strong>{{ impactSummary.affectedCanvas }}개</strong></div>
                                <div class="text-body-2">유실 가능 속성: <strong>{{ impactSummary.possibleLoss.join(', ') }}</strong></div>
                                <div class="text-body-2">롤백 스냅샷 준비: <strong>{{ impactSummary.rollbackReady ? '완료' : '미완료' }}</strong></div>
                            </v-sheet>

                            <div class="d-flex flex-wrap ga-2 mb-3">
                                <v-btn color="success" variant="flat" @click="selectedCluster && setClusterStatus(selectedCluster.id, 'approved')">클러스터 승인</v-btn>
                                <v-btn color="error" variant="outlined" @click="selectedCluster && setClusterStatus(selectedCluster.id, 'rejected')">클러스터 반려</v-btn>
                                <v-btn color="success" variant="flat" @click="selectedPattern && setPatternStatus(selectedPattern.id, 'approved')">패턴 승인</v-btn>
                                <v-btn color="error" variant="outlined" @click="selectedPattern && setPatternStatus(selectedPattern.id, 'rejected')">패턴 반려</v-btn>
                                <v-btn color="primary" @click="bulkMergeAndRegister">일괄 병합 및 등재</v-btn>
                            </div>

                            <div class="text-subtitle-2 mb-2">추천 예외 처리 (Blacklist)</div>
                            <div class="d-flex ga-2 mb-2">
                                <v-text-field v-model="blacklistInput" placeholder="영구 무시할 추천 용어 입력" hide-details density="compact" variant="outlined" @keyup.enter="addBlacklist" />
                                <v-btn variant="outlined" @click="addBlacklist">추가</v-btn>
                            </div>
                            <div class="d-flex flex-wrap ga-1">
                                <v-chip v-for="item in blacklist" :key="item" closable size="small" @click:close="removeBlacklist(item)">{{ item }}</v-chip>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>

                <v-col cols="12" lg="5">
                    <v-card variant="outlined" class="mb-4">
                        <v-card-title class="d-flex align-center justify-space-between">
                            <span>공통 시퀀스(Baseline) 추천</span>
                            <v-chip size="small" color="success">Baseline 후보</v-chip>
                        </v-card-title>
                        <v-card-text>
                            <div class="text-body-2 text-medium-emphasis mb-2">
                                {{ selectedPattern?.name }} 기준으로 전사 프로세스의 약 90%를 커버 가능한 표준 흐름입니다.
                            </div>
                            <v-sheet class="baseline-preview pa-3 mb-3" rounded="lg">
                                <div class="text-caption mb-1">제안 시퀀스</div>
                                <div class="text-body-2">
                                    [알람 인지] -> [장애 진단] -> [복구 작업] -> [결과 검증]
                                </div>
                            </v-sheet>
                            <v-btn color="success" block>Baseline 채택</v-btn>
                        </v-card-text>
                    </v-card>

                    <v-card variant="outlined" class="mb-4">
                        <v-card-title>모듈 4: 마스터 데이터 저장소 (MDM)</v-card-title>
                        <v-card-text>
                            <v-table density="compact">
                                <thead>
                                    <tr>
                                        <th>표준어</th>
                                        <th>동의어</th>
                                        <th>오너</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="row in dictionary" :key="row.standardTerm">
                                        <td class="font-weight-medium">{{ row.standardTerm }}</td>
                                        <td>{{ row.synonyms.join(', ') }}</td>
                                        <td>{{ row.owner }}</td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </v-card-text>
                    </v-card>

                    <v-card variant="outlined" class="mb-4">
                        <v-card-title>에디터 실시간 교정 (Page 2 연동)</v-card-title>
                        <v-card-text>
                            <v-text-field model-value="고장 수리" density="compact" variant="outlined" label="Task 명칭 입력 예시" readonly />
                            <v-alert density="comfortable" variant="tonal" type="success">
                                💡 장애 조치 (표준어 추천) - 클릭 시 즉시 치환
                            </v-alert>
                            <v-alert density="comfortable" variant="tonal" type="info" class="mt-2">
                                3개 이상 Task 시퀀스 연결 시 비동기 패턴 추천 팝업이 트리거됩니다.
                            </v-alert>
                        </v-card-text>
                    </v-card>

                    <v-card variant="outlined">
                        <v-card-title>감사 정책 룰셋 관리</v-card-title>
                        <v-card-text>
                            <v-file-input
                                label="PDF/CSV 컴플라이언스 문서 업로드"
                                density="compact"
                                variant="outlined"
                                prepend-icon="mdi-file-upload-outline"
                                show-size
                                hide-details
                                accept=".pdf,.csv"
                                class="mb-3"
                            />
                            <v-list density="compact" class="pa-0">
                                <v-list-item v-for="file in uploadedPolicies" :key="file.name">
                                    <template #prepend><v-icon size="18">mdi-shield-check-outline</v-icon></template>
                                    <v-list-item-title>{{ file.name }}</v-list-item-title>
                                    <v-list-item-subtitle>{{ file.status }}</v-list-item-subtitle>
                                </v-list-item>
                            </v-list>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.governance-page {
    height: 100%;
    overflow: auto;
    background: #fff;
}

.cluster-card {
    cursor: pointer;
    border: 1px solid #eceff3;
}

.impact-sheet {
    border: 1px dashed #d3d9e5;
    background: #f8fafc;
}

.baseline-preview {
    border: 1px solid #d5f0e2;
    background: linear-gradient(180deg, #f4fbf7 0%, #ffffff 100%);
}
</style>
