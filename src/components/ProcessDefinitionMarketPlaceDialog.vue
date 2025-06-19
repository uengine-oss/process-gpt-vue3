<template>
    <v-card>
        <v-card-title class="d-flex justify-space-between">
            <div class="d-flex align-center">{{ $t('ProcessDefinitionMarketPlaceDialog.title') }}</div>
            <v-btn @click="close" icon variant="text" density="comfortable">
                <Icons :icon="'close'" :size="16" />
            </v-btn>
        </v-card-title>
        <v-card-text>
            <v-text-field v-model="newDefinition.id" :label="$t('ProcessDefinitionMarketPlaceDialog.processId')"
                disabled
            />
            <v-text-field v-model="newDefinition.name" :label="$t('ProcessDefinitionMarketPlaceDialog.processName')" 
                disabled
            />
            <v-textarea v-model="newDefinition.description" :label="$t('ProcessDefinitionMarketPlaceDialog.description')" rows="3" />
            <div class="d-flex justify-space-between">
                <v-text-field v-model="megaCategory" :label="$t('ProcessDefinitionMarketPlaceDialog.category1') + ' *'" class="mr-1" />
                <v-text-field v-model="majorCategory" :label="$t('ProcessDefinitionMarketPlaceDialog.category2') + ' *'" class="ml-1" />
            </div>
            <v-combobox
                v-model="tagsArray"
                :label="$t('ProcessDefinitionMarketPlaceDialog.tags') + ' *'"
                multiple
                chips
                clearable
                closable-chips
                variant="outlined"
                :items="availableTags"
            />
            
            <!-- 이미지 미리보기 및 컨트롤 섹션 -->
            <div class="mt-4">
                <div class="text-subtitle-1 mb-2">프로세스 대표 이미지</div>
                <div class="image-preview-container d-flex flex-column align-center">
                    <div v-if="imagePreview" class="image-preview mb-2">
                        <img :src="imagePreview" alt="프로세스 이미지" class="preview-image"/>
                    </div>
                    <div v-else class="no-image-placeholder mb-2 d-flex align-center justify-center">
                        <span class="text-medium-emphasis">이미지가 없습니다</span>
                    </div>
                    <div class="d-flex gap-2">
                        <v-btn 
                            color="primary" 
                            variant="outlined" 
                            @click="handleImageUpload"
                            :prepend-icon="imagePreview ? 'mdi-image-refresh' : 'mdi-image-plus'"
                        >
                            {{ imagePreview ? '이미지 변경' : '이미지 추가' }}
                        </v-btn>
                        <!-- <v-btn 
                            color="primary" 
                            variant="outlined" 
                            @click="generateImage"
                            :prepend-icon="imagePreview ? 'mdi-refresh' : 'mdi-image-edit'"
                        >
                            {{ imagePreview ? '이미지 재생성' : '이미지 생성' }}
                        </v-btn> -->
                        <input
                            type="file"
                            ref="fileInput"
                            accept="image/*"
                            style="display: none"
                            @change="onFileSelected"
                        />
                    </div>
                </div>
            </div>
        </v-card-text>
        <v-card-actions class="d-flex justify-center">
            <v-btn @click="addDefinition" color="primary" rounded variant="flat" :disabled="!isFormValid">
                {{ $t('ProcessDefinitionMarketPlaceDialog.register') }}
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ImageGenerator from '@/components/ai/ImageGenerator';
const backend = BackendFactory.createBackend();

export default {
    props: {
        processDefinition: Object,
        bpmn: String,
    },
    data: () => ({
        newDefinition: {
            id: '',
            name: '',
            description: '',
            category: '',
            tags: '',
            author_name: '',
            author_email: '',
            image: null,
        },
        // category
        megaCategory: '',
        majorCategory: '',
        // tags
        tagsArray: [],
        availableTags: [],
        // 이미지 관련
        imagePreview: null,
        isGeneratingImage: false,
        generator: null,
    }),
    computed: {
        isFormValid() {
            return this.megaCategory && this.majorCategory && this.tagsArray.length > 0;
        }
    },
    mounted() {
        if (this.bpmn && this.processDefinition && this.processDefinition.processDefinitionId) {
            this.newDefinition = {
                id: this.processDefinition.processDefinitionId,
                name: this.processDefinition.processDefinitionName,
                definition: this.processDefinition,
                bpmn: this.bpmn,
                description: '',
                category: '',
                tags: '',
                author_name: '',
                author_email: '',
                image: null,
            };
            this.megaCategory = '';
            this.majorCategory = '';
        }
        this.generator = new ImageGenerator(this, {
            isStream: false,
            model: 'dall-e-3'
        });
    },
    watch: {
        'tagsArray': {
            deep: true,
            handler(newVal) {
                this.newDefinition.tags = newVal ? newVal.join(',') : '';
            }
        },
        'megaCategory': {
            handler() {
                this.newDefinition.category = `${this.megaCategory}/${this.majorCategory}`;
            }
        },
        'majorCategory': {
            handler() {
                this.newDefinition.category = `${this.megaCategory}/${this.majorCategory}`;
            }
        }
    },
    methods: {
        async addDefinition() {
            await backend.putTemplateDefinition(this.newDefinition);
            this.close();
        },
        close() {
            this.$emit('toggleMarketplaceDialog', false);
        },
        handleImageUpload() {
            this.$refs.fileInput.click();
        },
        async onFileSelected(event) {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64String = e.target.result;
                    this.imagePreview = base64String;
                    this.newDefinition.image = base64String;
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('이미지 로드 중 오류 발생:', error);
            }
        },
        async generateImage() {
            if (this.isGeneratingImage) return;
            
            this.isGeneratingImage = true;
            try {
                this.generator.setProcessInfo(JSON.stringify(this.processDefinition));
                await this.generator.generate();
            } catch (error) {
                console.error('이미지 생성 중 오류 발생:', error);
            }
        },

        onGenerationFinished(response) {
            this.isGeneratingImage = false;
            this.imagePreview = response;
            this.newDefinition.image = response;
        }
    }
};
</script>

<style scoped>
.image-preview-container {
    width: 100%;
    max-width: 512px;
    margin: 0 auto;
}

.image-preview, .no-image-placeholder {
    width: 100%;
    height: 256px;
    border: 2px dashed #ccc;
    border-radius: 8px;
    overflow: hidden;
}

.preview-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.no-image-placeholder {
    background-color: #f5f5f5;
}
</style>
