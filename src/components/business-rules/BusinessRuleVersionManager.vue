<template>
    <v-dialog v-model="isOpen" max-width="100%" style="height: -webkit-fill-available;" persistent
        :fullscreen="isMobile"
    >
        <v-card flat>
            <v-card-title class="d-flex pa-4 pb-0">
                <h5 class="text-h5" :class="{ 'text-truncate': isMobile }" :style="{ maxWidth: isMobile ? '280px' : 'none' }">
                    {{ $t('businessRuleVersionManager.title', { name: currentRuleName }) }}
                </h5>
                <v-progress-circular v-if="loading" color="primary" :size="25" indeterminate
                    style="margin-left: 5px;"
                ></v-progress-circular>
                <v-btn icon class="ml-auto" variant="text" @click="close" density="compact">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <div class="d-flex pa-4 pt-2 align-center"
                :class="showXML ? '' : 'pb-0'"
            >
                <div class="mx-2">
                    <v-tooltip location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                density="comfortable" @click="showXML = !showXML">
                                <v-icon :color="showXML ? '#1976D2' : '#666666'">mdi-code-tags</v-icon>
                            </v-btn>
                        </template>
                        <span>{{ showXML ? $t('businessRuleVersionManager.dmnStructureView') : $t('businessRuleVersionManager.xmlView') }}</span>
                    </v-tooltip>
                </div>
                <v-btn @click="downloadXML"
                    color="gray"
                    variant="flat"
                    class="rounded-pill mr-2"
                >{{ $t('businessRuleVersionManager.xmlDownload', { version: currentSelectedVersion }) }}
                </v-btn>
                <v-btn
                    v-if="!viewerMode"
                    @click="changeVersion"
                    :disabled="isChangeButtonDisabled"
                    color="primary"
                    variant="flat"
                    class="rounded-pill"
                >{{ $t('businessRuleVersionManager.changeToVersion', { version: currentSelectedVersion || '' }) }}
                </v-btn>
            </div>

            <v-card-text :class="showXML ? 'pa-4 pt-6 pb-0' : 'pa-4'"
                :style="showXML ? 'height: calc(100vh - 280px);' : 'height: 100vh;'"
            >
                <div class="version-layout" :class="{ 'version-layout-column': isMobile }">
                    <!-- DMN / XML 뷰어 -->
                    <div class="version-main version-main-gutter">
                        <div v-if="showXML" style="height: 100%; position: relative;">
                            <div class="version-manager-version-number" style="left: 0px; top: -32px;">
                                {{ $t('businessRuleVersionManager.version', { version: currentSelectedVersion || '' }) }}
                            </div>
                            <div class="version-manager-version-number" style="left: 50%; top: -32px;">
                                {{ $t('businessRuleVersionManager.version', { version: rightVersion || '' }) }}
                            </div>
                            <vuediff :prev="currentSelectedXML || ''" :current="rightXML || ''" mode="split" theme="light"
                                class="version-manager-vuediff-box"
                                language="xml"
                                style="height: 100%;"
                            />
                        </div>
                        <div v-else style="height: 100%; position: relative;">
                            <v-card outlined
                                style="width: 100%; height: 100%; position: relative;"
                                elevation="10"
                            >
                                <!-- 왼쪽: 선택한 버전 -->
                                <div class="version-manager-version-header" style="left: 16px; top: 16px;">
                                    <div class="version-manager-version-pill">
                                        {{ $t('businessRuleVersionManager.version', { version: currentSelectedVersion || '' }) }}
                                    </div>
                                </div>
                                <div v-if="currentVersionMessage" 
                                    class="version-manager-description"
                                    :class="{ 'expanded': leftDescExpanded }"
                                    @click="leftDescExpanded = !leftDescExpanded"
                                    style="left: 16px; top: 44px;"
                                >
                                    <span class="desc-text">{{ currentVersionMessage }}</span>
                                    <v-icon size="14" class="desc-icon">{{ leftDescExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                </div>
                                
                                <!-- 오른쪽: 최신 버전 -->
                                <div class="version-manager-version-header" style="right: 16px; left: auto; top: 16px;">
                                    <div class="version-manager-version-pill">
                                        {{ $t('businessRuleVersionManager.version', { version: rightVersion || '' }) }}
                                    </div>
                                    <div class="version-manager-production-label" style="margin-left: 8px;">
                                        {{ $t('businessRuleVersionManager.latestVersion') }}
                                    </div>
                                </div>
                                <div v-if="rightVersionMessage" 
                                    class="version-manager-description"
                                    :class="{ 'expanded': rightDescExpanded }"
                                    @click="rightDescExpanded = !rightDescExpanded"
                                    style="right: 16px; left: auto; top: 44px; max-width: calc(50% - 100px);"
                                >
                                    <span class="desc-text">{{ rightVersionMessage }}</span>
                                    <v-icon size="14" class="desc-icon">{{ rightDescExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                </div>
                                
                                <div style="height: 100%; overflow-y: auto; padding: 16px; padding-top: 80px;">
                                    <!-- 버전이 하나만 있는 경우 -->
                                    <div v-if="lists.length === 1" class="text-medium-emphasis pa-4 text-center">
                                        {{ $t('businessRuleVersionManager.noOtherVersions', { version: rightVersion || '' }) }}
                                    </div>
                                    <!-- 두 버전이 모두 있으면 비교 뷰 표시 (동일한 버전이어도 표시) -->
                                    <dmn-diff-view 
                                        v-else-if="currentSelectedDmn && rightDmn"
                                        :previous="currentSelectedDmn" 
                                        :current="rightDmn"
                                    />
                                    <!-- DMN 데이터가 없는 경우 -->
                                    <div v-else-if="!currentSelectedDmn && !rightDmn" class="text-medium-emphasis pa-4 text-center">
                                        {{ $t('businessRuleVersionManager.cannotLoadDmnStructure') }}
                                    </div>
                                    <div v-else-if="!currentSelectedDmn" class="text-medium-emphasis pa-4 text-center">
                                        {{ $t('businessRuleVersionManager.cannotLoadSelectedDmnStructure') }}
                                    </div>
                                    <div v-else class="text-medium-emphasis pa-4 text-center">
                                        {{ $t('businessRuleVersionManager.cannotLoadLatestDmnStructure') }}
                                    </div>
                                </div>
                            </v-card>
                        </div>
                    </div>

                    <!-- 앞쪽에 겹쳐지는 버전 리스트 오버레이 -->
                    <div v-if="versionListExpanded" class="version-sidebar-overlay">
                        <div class="version-sidebar-wrapper">
                            <div class="version-sidebar">
                                <div class="version-sidebar-header">
                                    <span class="text-body-2 font-weight-medium">
                                        {{ $t('businessRuleVersionManager.versionList', { count: filteredLists.length }) }}
                                    </span>
                                </div>
                                <v-list
                                    density="compact"
                                    class="version-list"
                                >
                                    <v-list-item
                                        v-for="(item, index) in filteredLists"
                                        :key="item.version || index"
                                        :active="index === currentIndex"
                                        @click="selectVersion(index)"
                                    >
                                        <v-list-item-title>
                                            <div class="d-flex align-center">
                                                <span class="mr-2">v{{ item.version }}</span>
                                                <span v-if="item.name" class="text-caption text-medium-emphasis">
                                                    {{ item.name }}
                                                </span>
                                            </div>
                                        </v-list-item-title>
                                        <v-list-item-subtitle>
                                            <div>
                                                {{ formatVersionTime(item.created_at) }}
                                            </div>
                                            <div v-if="item.created_by" class="version-list-desc-inline">
                                                {{ $t('businessRuleVersionManager.changer', { name: item.created_by }) }}
                                            </div>
                                        </v-list-item-subtitle>
                                    </v-list-item>
                                </v-list>
                            </div>
                            <v-tooltip :text="$t('businessRuleVersionManager.versionListTooltip')" location="right">
                                <template #activator="{ props }">
                                    <div
                                        v-bind="props"
                                        class="version-toggle-bar"
                                        @click="versionListExpanded = false"
                                    >
                                        <v-icon size="24" class="mb-1">mdi-chevron-left</v-icon>
                                    </div>
                                </template>
                            </v-tooltip>
                        </div>
                    </div>

                    <!-- 접혔을 때 화면 왼쪽에만 얇은 바 형태로 보이는 토글 -->
                    <v-tooltip v-else :text="$t('businessRuleVersionManager.versionListTooltip')" location="right">
                        <template #activator="{ props }">
                            <div
                                v-bind="props"
                                class="version-toggle-bar version-toggle-bar-collapsed"
                                @click="versionListExpanded = true"
                            >
                                <v-icon size="24" class="mb-1">mdi-menu</v-icon>
                                <span class="version-toggle-label">
                                    {{ $t('businessRuleVersionManager.versionListTooltip') }}
                                </span>
                            </div>
                        </template>
                    </v-tooltip>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { parseDmnXml } from '@/utils/dmnParser';
import DmnDiffView from '@/components/dmn/DmnDiffView.vue';
import DmnStructureView from '@/components/dmn/DmnStructureView.vue';

export default {
    name: 'BusinessRuleVersionManager',
    components: {
        DmnDiffView,
        DmnStructureView
    },
    props: {
        ruleId: String,
        ruleName: String,
        viewerMode: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            isOpen: false,
            loading: false,
            showXML: false,
            key: 0,
            currentIndex: 0,
            lists: [],
            backend: null,
            currentRuleName: '',
            currentSelectedVersion: null,
            currentSelectedXML: null,
            currentSelectedDmn: null,
            currentVersionMessage: null,
            rightVersion: null,
            rightXML: null,
            rightDmn: null,
            rightVersionMessage: null,
            versionListExpanded: true,
            leftDescExpanded: false,
            rightDescExpanded: false,
            isMobile: false
        };
    },
    computed: {
        filteredLists() {
            return this.lists || [];
        },
        isChangeButtonDisabled() {
            // 항상 활성화 (최신 버전에서도 변경 가능)
            return false;
        }
    },
    watch: {
        isOpen(newVal) {
            if (!newVal) {
                this.$emit('close');
            }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
        this.checkIfMobile();
        window.addEventListener('resize', this.checkIfMobile);
    },
    mounted() {
        // 컴포넌트가 마운트되면 바로 로드
        if (this.ruleId) {
            this.isOpen = true;
            this.load();
        }
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.checkIfMobile);
    },
    methods: {
        checkIfMobile() {
            this.isMobile = window.innerWidth < 768;
        },
        close() {
            this.isOpen = false;
        },
        async load() {
            if (!this.ruleId || !this.backend) return;
            
            this.loading = true;
            this.currentRuleName = this.ruleName || this.$t('businessRuleVersionManager.businessRule');
            
            try {
                // 버전 목록 조회
                const versions = await this.backend.getBusinessRuleVersions(this.ruleId);
                console.log('[BusinessRuleVersionManager] 조회된 버전 목록:', versions);
                if (versions && versions.length > 0) {
                    this.lists = versions.map(v => ({
                        ...v,
                        xml: null,
                        dmn: null
                    }));
                    console.log('[BusinessRuleVersionManager] lists 설정 완료:', this.lists);
                    
                    // 최신 버전 인덱스
                    const latestIndex = this.lists.length - 1;
                    this.currentIndex = latestIndex;
                    
                    // 최신 버전 XML 로드
                    await this.loadVersionXML(latestIndex);
                    
                    // 오른쪽 버전(최신) 설정
                    this.rightVersion = this.lists[latestIndex]?.version;
                    this.rightXML = this.lists[latestIndex]?.xml;
                    this.rightDmn = this.lists[latestIndex]?.dmn;
                    this.rightVersionMessage = this.lists[latestIndex]?.description || '';
                    
                    // 초기 선택 버전 설정 (비교 가능하도록 이전 버전 선택)
                    if (this.lists.length > 1) {
                        // 이전 버전이 있으면 이전 버전 선택
                        const previousIndex = latestIndex - 1;
                        await this.handleBeforeChange(previousIndex);
                        this.currentIndex = previousIndex;
                    } else {
                        // 버전이 하나만 있으면 최신 버전 선택
                        await this.handleBeforeChange(latestIndex);
                    }
                    
                    this.isOpen = true;
                } else {
                    this.$try({
                        action: async () => {},
                        warningMsg: this.$t('businessRuleVersionManager.noVersionInfo')
                    });
                }
            } catch (e) {
                console.error('버전 목록 로드 실패:', e);
                this.$try({
                    action: async () => {},
                    warningMsg: this.$t('businessRuleVersionManager.cannotLoadVersionList')
                });
            } finally {
                this.loading = false;
            }
        },
        async loadVersionXML(index) {
            if (!this.lists[index]) return;
            
            const version = this.lists[index].version;
            try {
                // 버전별 DMN XML 로드
                const isLatestVersion = index === this.lists.length - 1;
                if (isLatestVersion) {
                    // 최신 버전: 현재 룰에서 로드
                    const rule = await this.backend.getBusinessRule(this.ruleId);
                    if (rule && rule.dmnXml) {
                        this.lists[index].xml = rule.dmnXml;
                        this.lists[index].dmn = parseDmnXml(rule.dmnXml);
                    } else {
                        // dmnXml이 없으면 raw definition에서 직접 로드
                        const raw = await this.backend.getRawDefinition(`businessRules/${encodeURIComponent(this.ruleId)}`, { type: 'rule' });
                        if (raw) {
                            const dto = typeof raw === 'string' ? JSON.parse(raw) : raw;
                            if (dto.ruleJson?.dmnXml) {
                                this.lists[index].xml = dto.ruleJson.dmnXml;
                                this.lists[index].dmn = parseDmnXml(dto.ruleJson.dmnXml);
                            }
                        }
                    }
                } else {
                    // 이전 버전: versions 폴더에서 로드
                    const versionPath = `businessRules/${encodeURIComponent(this.ruleId)}/versions/${version}`;
                    const versionRaw = await this.backend.getRawDefinition(versionPath, { type: 'rule' });
                    
                    // 파일이 실제로 존재하는지 확인
                    if (!versionRaw) {
                        console.warn(`[loadVersionXML] 버전 파일이 존재하지 않음: ${version}`);
                        // 목록에서 제거
                        this.lists.splice(index, 1);
                        return;
                    }
                    
                    const versionDto = typeof versionRaw === 'string' 
                        ? (versionRaw.trim() ? JSON.parse(versionRaw) : null)
                        : versionRaw;
                    
                    if (versionDto && versionDto.ruleJson?.dmnXml) {
                        this.lists[index].xml = versionDto.ruleJson.dmnXml;
                        this.lists[index].dmn = parseDmnXml(versionDto.ruleJson.dmnXml);
                    } else {
                        console.warn(`[loadVersionXML] 버전 파일에 DMN XML이 없음: ${version}`);
                        // 목록에서 제거
                        this.lists.splice(index, 1);
                    }
                }
            } catch (e) {
                console.warn(`[loadVersionXML] 버전 ${version} XML 로드 실패, 목록에서 제거:`, e);
                // 파일을 읽을 수 없는 경우 목록에서 제거
                if (this.lists[index]) {
                    this.lists.splice(index, 1);
                }
            }
        },
        async handleBeforeChange(index) {
            this.loading = true;
            if (!this.lists[index]) return;
            
            if (!this.lists[index].xml) {
                await this.loadVersionXML(index);
            }
            
            this.currentSelectedVersion = this.lists[index].version;
            this.currentSelectedXML = this.lists[index].xml;
            this.currentSelectedDmn = this.lists[index].dmn;
            this.currentVersionMessage = this.lists[index].description || '';
            
            this.loading = false;
            this.key++;
        },
        selectVersion(index) {
            this.currentIndex = index;
            this.handleBeforeChange(index);
            this.versionListExpanded = false;
        },
        async changeVersion() {
            if (!this.currentSelectedVersion || !this.currentSelectedXML) return;
            
            try {
                // 선택한 버전의 전체 룰 데이터를 로드
                const versionPath = `businessRules/${encodeURIComponent(this.ruleId)}/versions/${this.currentSelectedVersion}`;
                const versionRaw = await this.backend.getRawDefinition(versionPath, { type: 'rule' });
                
                if (!versionRaw) {
                    this.$try({
                        action: async () => {},
                        warningMsg: '버전 파일을 불러올 수 없습니다.'
                    });
                    return;
                }
                
                // 버전 파일에서 받은 JSON을 그대로 가져오기
                const versionDto = typeof versionRaw === 'string' ? JSON.parse(versionRaw) : versionRaw;
                
                // 부모 컴포넌트에 버전 파일의 전체 JSON 전달 (현재 룰 파일로 덮어쓰기)
                this.$emit('versionChanged', {
                    versionDto,
                    ruleId: this.ruleId,
                    version: this.currentSelectedVersion
                });
                
                // 다이얼로그 닫기
                this.isOpen = false;
            } catch (e) {
                console.error('버전 변경 실패:', e);
                this.$try({
                    action: async () => {},
                    warningMsg: this.$t('businessRuleVersionManager.versionChangeFailed')
                });
            }
        },
        downloadXML() {
            const xml = this.lists[this.currentIndex]?.xml;
            if (xml) {
                const blob = new Blob([xml], { type: 'application/xml' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${this.currentRuleName}-v${this.currentSelectedVersion || this.lists[this.currentIndex]?.version}.xml`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert(this.$t('businessRuleVersionManager.noXmlData'));
            }
        },
        formatVersionTime(timeStamp) {
            if (!timeStamp) return '';
            const date = new Date(timeStamp);
            if (isNaN(date.getTime())) {
                return timeStamp;
            }
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            if (diffMs < 0) {
                return date.toLocaleString('ko-KR');
            }
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            if (diffHour < 24) {
                return this.$t('businessRuleVersionManager.hoursAgo', { hours: diffHour });
            }
            return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
};
</script>

<style scoped>
.version-layout {
    display: flex;
    gap: 12px;
    height: 100%;
    position: relative;
}

.version-main {
    flex: 1;
    min-width: 0;
    height: 100%;
}

.version-main-gutter {
    margin-left: 24px;
}

.version-layout-column {
    flex-direction: column;
}

.version-sidebar-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    display: flex;
    z-index: 20;
}

.version-sidebar {
    width: 320px;
    max-width: 100%;
    height: 100%;
    overflow-y: auto;
    background-color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.version-sidebar-header {
    padding: 4px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    margin-bottom: 4px;
}

.version-list .v-list-item {
    cursor: pointer;
}

.version-toggle-bar {
    width: 24px;
    min-width: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background-color: #ffffff;
    border-radius: 0 6px 6px 0;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
    z-index: 25;
}

.version-toggle-bar-collapsed {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    height: auto;
    border-radius: 6px;
    z-index: 25;
}

.version-toggle-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 14px;
    line-height: 1;
}

.version-manager-version-number {
    position: absolute;
    left: 16px;
    top: 16px;
    background: rgba(255, 255, 255, 0.9);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.version-manager-version-header {
    position: absolute;
    left: 16px;
    top: 16px;
    display: flex;
    gap: 8px;
    z-index: 10;
}

.version-manager-version-pill {
    background: rgba(255, 255, 255, 0.9);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.version-manager-deploy-btn {
    cursor: pointer;
    background-color: #1976d2;
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.version-manager-production-label {
    background-color: #4caf50;
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.version-manager-description {
    position: absolute;
    left: 16px;
    top: 44px;
    background: rgba(255, 255, 255, 0.95);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
    max-width: calc(100% - 100px);
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
}

.version-manager-description .desc-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
}

.version-manager-description .desc-icon {
    flex-shrink: 0;
    margin-left: 4px;
}

.version-manager-description:hover {
    background: rgba(255, 255, 255, 1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.version-manager-description.expanded {
    max-height: 200px;
    overflow-y: auto;
}

.version-manager-description.expanded .desc-text {
    white-space: normal;
}

.version-list-desc-inline {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.version-manager-vuediff-box {
    height: 100%;
    width: 100%;
}

.flex-column {
    flex-direction: column !important;
}
</style>
