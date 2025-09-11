<template>
    <v-card class="process-feedback" elevation="2">
        <v-card-text v-if="isAcceptMode" class="pa-4">
            <div class="d-flex justify-start align-center mb-2">
                <v-icon>mdi-information</v-icon>
                <span class="text-h6 ml-2">피드백 반영</span>
            </div>
            <v-skeleton-loader
                v-if="isLoading"
                type="image"
                class="mx-auto"
            ></v-skeleton-loader>
            
            <!-- 데스크톱 테이블 뷰 -->
            <v-table v-else-if="!isLoading && !isMobile" class="diff-table">
                <thead>
                    <tr>
                        <th class="text-left" scope="col">반영 여부</th>
                        <th class="text-left" scope="col">속성</th>
                        <th class="text-left" scope="col">피드백 반영 전</th>
                        <th class="text-left" scope="col">피드백 반영 후</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="Object.keys(diffItems).length === 0">
                        <td colspan="4" class="text-center px-0">
                            <v-icon class="mr-2">mdi-information</v-icon>
                            반영 할 내용이 없습니다.
                        </td>
                    </tr>
                    <tr v-for="(item, key) in diffItems" :key="key">
                        <td class="text-center">
                            <v-checkbox v-model="item.accepted"
                                hide-details
                                color="primary"
                                density="compact"
                            />
                        </td>
                        <td>{{ item.title }}</td>
                        <td>
                            <div v-if="Array.isArray(item.before)">
                                <v-list density="compact" class="diff-list">
                                    <v-list-item
                                        v-for="(listItem, index) in item.before"
                                        :key="`${key}-before-${index}`"
                                        class="px-2"
                                    >
                                        <v-list-item-title class="text-body-2">
                                            <template v-if="typeof listItem === 'object' && listItem.name">
                                                <div class="font-weight-medium">{{ listItem.name }}</div>
                                            </template>
                                            <template v-else>
                                                {{index+1}}. {{ listItem }}
                                            </template>
                                        </v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </div>
                            <div v-else-if="typeof item.before === 'object'">
                                <template v-if="key === 'conditionExamples'">
                                    <div class="pa-2">
                                        <div class="gwt-section-title">좋은 예시</div>
                                        <div v-if="item.before && item.before.good_example && item.before.good_example.length > 0">
                                            <div v-for="(ex, gi) in item.before.good_example" :key="`${key}-before-good-${gi}`" class="gwt-card">
                                                <div class="gwt-row"><span class="gwt-label">given</span><span class="gwt-text">{{ ex.given }}</span></div>
                                                <div class="gwt-row"><span class="gwt-label">when</span><span class="gwt-text">{{ ex.when }}</span></div>
                                                <div class="gwt-row"><span class="gwt-label">then</span><span class="gwt-text">{{ ex.then }}</span></div>
                                            </div>
                                        </div>
                                        <div v-else class="text-grey text-body-2">내용 없음</div>
                                        <div class="gwt-divider"></div>
                                        <div class="gwt-section-title">나쁜 예시</div>
                                        <div v-if="item.before && item.before.bad_example && item.before.bad_example.length > 0">
                                            <div v-for="(ex, bi) in item.before.bad_example" :key="`${key}-before-bad-${bi}`" class="gwt-card">
                                                <div class="gwt-row"><span class="gwt-label">given</span><span class="gwt-text">{{ ex.given }}</span></div>
                                                <div class="gwt-row"><span class="gwt-label">when</span><span class="gwt-text">{{ ex.when }}</span></div>
                                                <div class="gwt-row"><span class="gwt-label">then</span><span class="gwt-text">{{ ex.then }}</span></div>
                                            </div>
                                        </div>
                                        <div v-else class="text-grey text-body-2">내용 없음</div>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class="text-body-2 pa-2">{{ item.before }}</div>
                                </template>
                            </div>
                            <div v-else>
                                <div class="text-body-2 pa-2">{{ item.before }}</div>
                            </div>
                        </td>
                        <td>
                            <div v-if="Array.isArray(item.after)">
                                <template v-if="diffItems[key] && diffItems[key].changed">
                                    <!-- Diff UI 적용된 배열 표시 -->
                                    <div class="diff-list pa-2 align-center">
                                        <div v-for="(diffItem, index) in calculateArrayDiff(item.before, item.after).after"
                                            :key="`${key}-after-diff-${index}`"
                                            :class="['diff-list-item', diffItem.type]"
                                        >
                                            <span class="diff-icon"></span>
                                            <span class="text-body-2">{{index+1}}. {{ diffItem.text }}</span>
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
                                    <!-- 기본 배열 표시 -->
                                <v-list density="compact" class="diff-list">
                                    <v-list-item
                                        v-for="(listItem, index) in item.after"
                                        :key="`${key}-after-${index}`"
                                        class="px-2"
                                    >
                                        <v-list-item-title class="text-body-2">
                                            <template v-if="typeof listItem === 'object' && listItem.name">
                                                <div class="font-weight-medium">{{ listItem.name }}</div>
                                            </template>
                                            <template v-else>
                                                {{index+1}}. {{ listItem }}
                                            </template>
                                        </v-list-item-title>
                                    </v-list-item>
                                </v-list>
                                </template>
                            </div>
                            <div v-else-if="typeof item.after === 'object'">
                                <template v-if="key === 'conditionExamples'">
                                    <div class="pa-2">
                                        <div class="gwt-section-title">좋은 예시</div>
                                        <div v-if="item.after && item.after.good_example">
                                            <div v-for="(ex, gi) in calculateGwtArrayDiff(item.before && item.before.good_example, item.after.good_example)" :key="`${key}-after-good-${gi}`" class="gwt-card" :class="[{ added: ex.__isNew }]">
                                                <div class="gwt-row">
                                                    <span class="gwt-label">given</span>
                                                    <span class="gwt-text">
                                                        <span :class="['diff-word', ex.given.type]">{{ ex.given.text }}</span>
                                                    </span>
                                                </div>
                                                <div class="gwt-row">
                                                    <span class="gwt-label">when</span>
                                                    <span class="gwt-text">
                                                        <span :class="['diff-word', ex.when.type]">{{ ex.when.text }}</span>
                                                    </span>
                                                </div>
                                                <div class="gwt-row">
                                                    <span class="gwt-label">then</span>
                                                    <span class="gwt-text">
                                                        <span :class="['diff-word', ex.then.type]">{{ ex.then.text }}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-else class="text-grey text-body-2">내용 없음</div>
                                        <div class="gwt-divider"></div>
                                        <div class="gwt-section-title">나쁜 예시</div>
                                        <div v-if="item.after && item.after.bad_example">
                                            <div v-for="(ex, bi) in calculateGwtArrayDiff(item.before && item.before.bad_example, item.after.bad_example)" :key="`${key}-after-bad-${bi}`" class="gwt-card" :class="[{ added: ex.__isNew }]">
                                                <div class="gwt-row">
                                                    <span class="gwt-label">given</span>
                                                    <span class="gwt-text">
                                                        <span :class="['diff-word', ex.given.type]">{{ ex.given.text }}</span>
                                                    </span>
                                                </div>
                                                <div class="gwt-row">
                                                    <span class="gwt-label">when</span>
                                                    <span class="gwt-text">
                                                        <span :class="['diff-word', ex.when.type]">{{ ex.when.text }}</span>
                                                    </span>
                                                </div>
                                                <div class="gwt-row">
                                                    <span class="gwt-label">then</span>
                                                    <span class="gwt-text">
                                                        <span :class="['diff-word', ex.then.type]">{{ ex.then.text }}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-else class="text-grey text-body-2">내용 없음</div>
                                    </div>
                                </template>
                                <template v-else>
                                    <template v-if="diffItems[key] && diffItems[key].changed">
                                        <!-- Diff UI 적용된 문자열 표시 -->
                                        <div class="text-body-2 pa-2 diff-text">
                                            <span
                                                v-for="(diffWord, index) in calculateStringDiff(item.before, item.after).after"
                                                :key="`${key}-word-${index}`"
                                                :class="['diff-word', diffWord.type]"
                                            >{{ diffWord.text }}</span>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <!-- 기본 문자열 표시 -->
                                    <div class="text-body-2 pa-2">{{ item.after }}</div>
                                    </template>
                                </template>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </v-table>

            <!-- 모바일 카드 뷰 -->
            <div v-else-if="!isLoading && isMobile" class="mobile-diff-view">
                <v-card
                    v-for="(item, key) in diffItems"
                    :key="`mobile-${key}`"
                    :class="['mb-2', { 'card-selected': item.accepted }]"
                    elevation="1"
                    variant="outlined"
                >
                    <div class="pa-2">
                            <v-checkbox v-model="item.accepted"
                                :label="item.title"
                                color="primary"
                                density="compact"
                                hide-details
                            />
                        </div>
                    
                    <v-card-text class="pt-0">
                        <!-- 반영 전 -->
                        <div class="mb-3">
                            <div class="text-body-2 font-weight-medium mb-1 text-grey-darken-1">피드백 반영 전</div>
                            <div class="mobile-content-box">
                                <div v-if="Array.isArray(item.before)">
                                    <div v-if="item.before.length === 0" class="text-grey text-body-2">내용 없음</div>
                                    <div v-else>
                                        <div
                                            v-for="(listItem, index) in item.before"
                                            :key="`${key}-mobile-before-${index}`"
                                            class="text-body-2 mb-1"
                                        >
                                            <template v-if="typeof listItem === 'object' && listItem.name">
                                                {{index+1}}. {{ listItem.name }}
                                            </template>
                                            <template v-else>
                                                {{index+1}}. {{ listItem }}
                                            </template>
                                        </div>
                                    </div>
                                </div>
                                <div v-else>
                                    <div class="text-body-2">{{ item.before || '내용 없음' }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- 반영 후 -->
                        <div>
                            <div class="text-body-2 font-weight-medium mb-1 text-grey-darken-1">피드백 반영 후</div>
                            <div class="mobile-content-box">
                                <div v-if="Array.isArray(item.after)">
                                    <template v-if="diffItems[key] && diffItems[key].changed">
                                        <!-- Diff UI 적용된 배열 표시 -->
                                        <div v-for="(diffItem, index) in calculateArrayDiff(item.before, item.after).after"
                                            :key="`${key}-mobile-after-diff-${index}`"
                                            :class="['mobile-diff-item', diffItem.type]"
                                            class="pa-2 align-center"
                                        >
                                            <span class="diff-icon-mobile"></span>
                                            <span class="text-body-2">{{index+1}}. {{ diffItem.text }}</span>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <!-- 기본 배열 표시 -->
                                        <div v-if="item.after.length === 0" class="text-grey text-body-2">내용 없음</div>
                                        <div v-else>
                                            <div
                                                v-for="(listItem, index) in item.after"
                                                :key="`${key}-mobile-after-${index}`"
                                                class="text-body-2 mb-1"
                                            >
                                                <template v-if="typeof listItem === 'object' && listItem.name">
                                                    {{index+1}}. {{ listItem.name }}
                                                </template>
                                                <template v-else>
                                                    {{index+1}}. {{ listItem }}
                                                </template>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                                <div v-else>
                                    <template v-if="key === 'conditionExamples'">
                                        <div class="text-body-2">
                                            <div class="gwt-section-title">좋은 예시</div>
                                            <div v-if="item.after && item.after.good_example">
                                                <div v-for="(ex, gi) in calculateGwtArrayDiff(item.before && item.before.good_example, item.after.good_example)" :key="`${key}-m-after-good-${gi}`" class="gwt-card" :class="[{ added: ex.__isNew }]">
                                                    <div class="gwt-row"><span class="gwt-label">given</span><span class="gwt-text"><span :class="['diff-word', ex.given.type]">{{ ex.given.text }}</span></span></div>
                                                    <div class="gwt-row"><span class="gwt-label">when</span><span class="gwt-text"><span :class="['diff-word', ex.when.type]">{{ ex.when.text }}</span></span></div>
                                                    <div class="gwt-row"><span class="gwt-label">then</span><span class="gwt-text"><span :class="['diff-word', ex.then.type]">{{ ex.then.text }}</span></span></div>
                                                </div>
                                            </div>
                                            <div v-else class="text-grey text-body-2">내용 없음</div>
                                            <div class="gwt-divider"></div>
                                            <div class="gwt-section-title">나쁜 예시</div>
                                            <div v-if="item.after && item.after.bad_example">
                                                <div v-for="(ex, bi) in calculateGwtArrayDiff(item.before && item.before.bad_example, item.after.bad_example)" :key="`${key}-m-after-bad-${bi}`" class="gwt-card" :class="[{ added: ex.__isNew }]">
                                                    <div class="gwt-row"><span class="gwt-label">given</span><span class="gwt-text"><span :class="['diff-word', ex.given.type]">{{ ex.given.text }}</span></span></div>
                                                    <div class="gwt-row"><span class="gwt-label">when</span><span class="gwt-text"><span :class="['diff-word', ex.when.type]">{{ ex.when.text }}</span></span></div>
                                                    <div class="gwt-row"><span class="gwt-label">then</span><span class="gwt-text"><span :class="['diff-word', ex.then.type]">{{ ex.then.text }}</span></span></div>
                                                </div>
                                            </div>
                                            <div v-else class="text-grey text-body-2">내용 없음</div>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <template v-if="diffItems[key] && diffItems[key].changed">
                                            <!-- Diff UI 적용된 문자열 표시 -->
                                            <div class="diff-text">
                                                <span
                                                    v-for="(diffWord, index) in calculateStringDiff(item.before, item.after).after"
                                                    :key="`${key}-mobile-word-${index}`"
                                                    :class="['diff-word', diffWord.type]"
                                                >{{ diffWord.text }}</span>
                                            </div>
                                        </template>
                                        <template v-else>
                                            <!-- 기본 문자열 표시 -->
                                            <div class="text-body-2">{{ item.after || '내용 없음' }}</div>
                                        </template>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </div>

            <v-row v-if="!isLoading" class="ma-0 pa-0 mt-2">
                <v-spacer></v-spacer>
                <v-btn @click="closeFeedback"
                    color="gray"
                    variant="elevated" 
                    class="rounded-pill mr-2"
                    density="compact"
                >취소</v-btn>
                <v-btn @click="setFeedbackDiff"
                    :disabled="!hasSelectedItems"
                    color="primary"
                    variant="elevated" 
                    class="rounded-pill"
                    density="compact"
                >반영</v-btn>
            </v-row>
        </v-card-text>

        <v-card-text v-else class="pa-3">
            <div class="d-flex justify-start align-center mb-2">
                <v-icon>mdi-information</v-icon>
                <span class="text-h6 ml-2">피드백을 선택해주세요</span>
            </div>
            
            <v-list class="feedback-list">
                <v-skeleton-loader
                    v-if="isLoading"
                    type="image"
                    class="mx-auto"
                ></v-skeleton-loader>
                <v-list-item
                    v-else
                    v-for="(item, index) in feedbackItems"
                    :key="'feedback-'+index"
                    :active="feedbackValue === item"
                    @click="feedbackValue = item"
                    class="feedback-item"
                >
                    <v-list-item-title>{{ item }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                    v-if="!isLoading"
                    :active="feedbackValue === 'etc'"
                    @click="feedbackValue = 'etc'"
                    class="feedback-item"
                >
                    <v-list-item-title>기타 입력</v-list-item-title>
                </v-list-item>
            </v-list>

            <v-textarea 
                v-if="feedbackValue == 'etc'"
                v-model="feedbackText"
                label="기타"
                rows="3"
            />
            <v-row class="ma-0 pa-0">
                <v-spacer></v-spacer>
                <v-btn @click="closeFeedback"
                    color="gray"
                    variant="elevated" 
                    class="rounded-pill mr-2"
                    density="compact"
                >취소</v-btn>
                <v-btn @click="submitFeedback"
                    :disabled="!feedbackValue"
                    color="primary"
                    variant="elevated" 
                    class="rounded-pill"
                    density="compact"
                >제출</v-btn>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    props: {
        lastMessage: Object,
        task: Object,
        isAcceptMode: Boolean,
    },
    data: () => ({
        isLoading: false,
        feedbackValue: null,
        feedbackItems: [],
        feedbackText: '',

        diffItems: {
            inputData: {
                title: '입력 데이터',
                before: [],
                after: [],
                accepted: true,
                changed: false
            },
            checkpoints: {
                title: '체크포인트',
                before: [],
                after: [],
                accepted: true,
                changed: false
            },
            description: {
                title: '설명',
                before: '',
                after: '',
                accepted: true,
                changed: false
            },
            instruction: {
                title: '지시사항',
                before: '',
                after: '',
                accepted: true,
                changed: false
            },
            conditionExamples: {
                title: '조건 예시',
                before: {},
                after: {},
                accepted: true,
                changed: false,
                sequenceId: ''
            }
        },
        feedbackDiff: {
            inputData: [],
            checkpoints: [],
            description: '',
            instruction: '',
            conditionExamples: {}
        }
    }),
    async mounted() {
        if (this.task && !this.isAcceptMode) {
            this.isLoading = true;
            this.feedbackValue = 'etc';
            await this.getFeedback();
        } else if (this.task && this.isAcceptMode) {
            this.isLoading = true;
            await this.getFeedbackDiff();
        }
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        hasSelectedItems() {
            return Object.values(this.diffItems).some(item => item.accepted);
        },
    },
    methods: {
        // Diff UI 관련 메서드들
        calculateStringDiff(before, after) {
            if (!before || !after) return { before: before || '', after: after || '' };
            
            const beforeWords = before.split(' ');
            const afterWords = after.split(' ');
            const beforeResult = [];
            const afterResult = [];
            
            let i = 0, j = 0;
            
            while (i < beforeWords.length || j < afterWords.length) {
                if (i >= beforeWords.length) {
                    // 추가된 단어들
                    afterResult.push({ type: 'added', text: afterWords[j] });
                    j++;
                } else if (j >= afterWords.length) {
                    // 삭제된 단어들
                    beforeResult.push({ type: 'removed', text: beforeWords[i] });
                    i++;
                } else if (beforeWords[i] === afterWords[j]) {
                    // 동일한 단어들
                    beforeResult.push({ type: 'unchanged', text: beforeWords[i] });
                    afterResult.push({ type: 'unchanged', text: afterWords[j] });
                    i++;
                    j++;
                } else {
                    // 변경된 부분 찾기
                    let found = false;
                    for (let k = j + 1; k < afterWords.length; k++) {
                        if (beforeWords[i] === afterWords[k]) {
                            // 중간에 추가된 단어들
                            for (let l = j; l < k; l++) {
                                afterResult.push({ type: 'added', text: afterWords[l] });
                            }
                            beforeResult.push({ type: 'unchanged', text: beforeWords[i] });
                            afterResult.push({ type: 'unchanged', text: afterWords[k] });
                            j = k + 1;
                            i++;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        beforeResult.push({ type: 'removed', text: beforeWords[i] });
                        afterResult.push({ type: 'added', text: afterWords[j] });
                        i++;
                        j++;
                    }
                }
            }
            
            return { before: beforeResult, after: afterResult };
        },
        
        calculateArrayDiff(before, after) {
            if (!Array.isArray(before)) before = [];
            if (!Array.isArray(after)) after = [];
            
            const beforeItems = before.map(item => ({ 
                text: typeof item === 'object' && item.name ? item.name : item, 
                type: 'unchanged' 
            }));
            const afterItems = [];
            
            // 기존 항목들 처리
            before.forEach((beforeItem, index) => {
                const beforeText = typeof beforeItem === 'object' && beforeItem.name ? beforeItem.name : beforeItem;
                const found = after.find(afterItem => {
                    const afterText = typeof afterItem === 'object' && afterItem.name ? afterItem.name : afterItem;
                    return beforeText === afterText;
                });
                
                if (!found) {
                    beforeItems[index].type = 'removed';
                }
            });
            
            // 새 항목들 처리
            after.forEach((afterItem) => {
                const afterText = typeof afterItem === 'object' && afterItem.name ? afterItem.name : afterItem;
                const found = before.find(beforeItem => {
                    const beforeText = typeof beforeItem === 'object' && beforeItem.name ? beforeItem.name : beforeItem;
                    return beforeText === afterText;
                });
                
                if (found) {
                    afterItems.push({ text: afterText, type: 'unchanged' });
                } else {
                    afterItems.push({ text: afterText, type: 'added' });
                }
            });
            
            return { before: beforeItems, after: afterItems };
        },

        calculateGwtArrayDiff(beforeArr, afterArr) {
            const normArr = (arr) => Array.isArray(arr) ? arr : [];
            const before = normArr(beforeArr);
            const after = normArr(afterArr);
            const getKey = (it) => (it && (it.given || it.then || it.when)) || JSON.stringify(it || {});
            const beforeMap = new Map();
            before.forEach((b) => beforeMap.set(getKey(b), b));
            return after.map((a) => {
                const key = getKey(a);
                const b = beforeMap.get(key);
                if (!b) {
                    return {
                        __isNew: true,
                        given: { text: a.given || '', type: 'added' },
                        when: { text: a.when || '', type: 'added' },
                        then: { text: a.then || '', type: 'added' },
                    };
                }
                return {
                    __isNew: false,
                    given: { text: a.given || '', type: (a.given || '') === (b.given || '') ? 'unchanged' : 'added' },
                    when: { text: a.when || '', type: (a.when || '') === (b.when || '') ? 'unchanged' : 'added' },
                    then: { text: a.then || '', type: (a.then || '') === (b.then || '') ? 'unchanged' : 'added' },
                };
            });
        },
        
        async getFeedback() {
            const obj = {
                processDefinitionId: this.task.defId,
                activityId: this.task.tracingTag,
                taskId: this.task.taskId,
            }
            const items = await backend.getFeedback(obj);
            if (items) {
                this.feedbackItems = items;
            }
            this.feedbackValue = '';
            this.isLoading = false;
        },
        async submitFeedback() {
            if (this.feedbackValue) {
                if (this.feedbackValue == 'etc') {
                    this.feedbackValue = this.feedbackText;
                }
                await backend.submitFeedback(this.feedbackValue, this.task.taskId);
                this.$emit('submitFeedback', this.task.taskId);
            }
        },
        closeFeedback() {
            this.$emit('closeFeedback');
        },
        async getFeedbackDiff() {
            const diff = await backend.getFeedbackDiff(this.task.taskId);
            // console.log('피드백 diff 데이터:', diff);
            if (diff && diff.modifications) {
                for (const key in diff.modifications) {
                    if (diff.modifications[key] && diff.modifications[key].changed) {
                        this.diffItems[key].before = diff.modifications[key].before;
                        this.diffItems[key].after = diff.modifications[key].after;
                        this.diffItems[key].changed = diff.modifications[key].changed;
                        if (key == 'conditionExamples') {
                            this.diffItems[key].sequenceId = diff.modifications[key].sequenceId;
                        }
                    } else {
                        delete this.diffItems[key];
                    }
                }
            }
            console.log(this.diffItems);
            this.isLoading = false;
        },
        async setFeedbackDiff() {
            if (!this.task || !this.diffItems || this.diffItems.length == 0) {
                return;
            }
            Object.keys(this.diffItems).forEach(key => {
                if (this.diffItems[key].accepted) {
                    this.feedbackDiff[key] = this.diffItems[key].after;
                    if (key == 'conditionExamples') {
                        this.feedbackDiff[key].sequenceId = this.diffItems[key].sequenceId;
                    }
                }
            });
            if (this.feedbackDiff && this.feedbackDiff.inputData) {
                this.feedbackDiff.inputData = this.feedbackDiff.inputData.map(item => item.key);
            }
            await backend.setFeedbackDiff(this.feedbackDiff, this.task.tracingTag, this.task.defId);
            this.closeFeedback();
        },

    }
}
</script>

<style scoped>
.feedback-list {
    margin-bottom: 16px;
}

.feedback-item {
    cursor: pointer;
    border-radius: 4px;
    margin-bottom: 4px;
    padding: 8px 12px !important;
}

.feedback-item:hover {
    background-color: #f5f5f5 !important;
}

.feedback-item .v-list-item-title {
    white-space: normal !important;
    word-wrap: break-word !important;
    line-height: 1.4 !important;
    font-size: 14px !important;
    padding: 4px 0 !important;
}

.feedback-item .v-list-item__content {
    padding: 0 !important;
}

.diff-table {
    width: 100%;
    table-layout: fixed;
}

.diff-table th,
.diff-table td {
    width: 25%;
}

.diff-table td {
    border-top: 1px solid #e0e0e0;
    border-bottom: 1px solid #e0e0e0;
}

.diff-table th:first-child,
.diff-table td:first-child {
    width: 65px !important;
}

.diff-table th:nth-child(2),
.diff-table td:nth-child(2) {
    width: 120px !important;
}

.diff-table th:nth-child(3),
.diff-table td:nth-child(3),
.diff-table th:nth-child(4),
.diff-table td:nth-child(4) {
    width: calc((100vw - 185px) / 2) !important;
}

.text-body-2 {
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: normal !important;
    line-height: 1.4 !important;
    overflow-wrap: break-word !important;
}

.v-list-item-title {
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: normal !important;
    line-height: 1.4 !important;
    overflow-wrap: break-word !important;
}

/* Diff UI 스타일 */
.diff-text {
    display: inline;
    line-height: 1.6;
}

.diff-word {
    display: inline;
    padding: 2px 0;
    margin: 0 1px;
    border-radius: 3px;
}

.diff-word.added {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
    padding: 1px 3px;
}

.diff-word.removed {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    text-decoration: line-through;
    padding: 1px 3px;
}

.diff-word.unchanged {
    color: inherit;
}

/* GWT structured cards */
.gwt-section-title {
    font-weight: 600;
    margin: 8px 0 4px;
}

.gwt-divider {
    border-top: 1px dashed #e0e0e0;
    margin: 8px 0;
}

.gwt-card {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 6px;
}

.gwt-card.added {
    background-color: #d4edda;
    border-left: 4px solid #28a745;
}

.gwt-row {
    display: flex;
    align-items: flex-start;
    margin: 2px 0;
}

.gwt-label {
    width: 48px;
    color: #6c757d;
    flex-shrink: 0;
}

.gwt-text {
    flex: 1;
    word-break: break-word;
}

.diff-list-item {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    margin: 2px 0;
    border-radius: 4px;
}

.diff-list-item.added {
    background-color: #d4edda;
    border-left: 4px solid #28a745;
}

.diff-list-item.removed {
    background-color: #f8d7da;
    border-left: 4px solid #dc3545;
    text-decoration: line-through;
}

.diff-list-item.unchanged {
    background-color: transparent;
}

.diff-list-item .diff-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    line-height: 100%;
}

.diff-list-item.added .diff-icon::before {
    content: '+';
    color: #28a745;
    font-weight: bold;
}

.diff-list-item.removed .diff-icon::before {
    content: '-';
    color: #dc3545;
    font-weight: bold;
}

.diff-list-item.unchanged .diff-icon::before {
    content: '';
}

/* 모바일 뷰 스타일 */
.mobile-diff-view {
    width: 100%;
}

.diff-card {
    border-radius: 8px !important;
    overflow: hidden;
}

.card-selected {
    border-color: rgb(var(--v-theme-primary)) !important;
    border-width: 2px !important;
}

.mobile-content-box {
    background-color: #f8f9fa;
    border-radius: 6px;
    padding: 12px;
    border: 1px solid #e9ecef;
    min-height: 40px;
}

.mobile-diff-item {
    display: flex;
    align-items: center;
    padding: 4px 0;
    margin: 2px 0;
    border-radius: 4px;
}

.mobile-diff-item.added {
    background-color: #d4edda;
    padding: 4px 8px;
    border-left: 3px solid #28a745;
}

.mobile-diff-item.removed {
    background-color: #f8d7da;
    padding: 4px 8px;
    border-left: 3px solid #dc3545;
    text-decoration: line-through;
}

.mobile-diff-item.unchanged {
    background-color: transparent;
}

.diff-icon-mobile {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    line-height: 100%;
}

.mobile-diff-item.added .diff-icon-mobile::before {
    content: '+';
    color: #28a745;
}

.mobile-diff-item.removed .diff-icon-mobile::before {
    content: '-';
    color: #dc3545;
}

.mobile-diff-item.unchanged .diff-icon-mobile::before {
    content: '';
}

/* 모바일에서 체크박스 스타일 조정 */
@media (max-width: 600px) {
    .diff-card .v-card-title {
        padding: 12px 16px 8px 16px !important;
    }
    
    .diff-card .v-card-text {
        padding: 0 16px 16px 16px !important;
    }
    
    .mobile-content-box {
        font-size: 14px;
        line-height: 1.4;
    }
}
</style>