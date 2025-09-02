<template>
  <div class="pa-4">
    <!-- DataSource 사용 여부 토글 - 개선된 UI -->
    <v-card flat class="mb-6 pa-1">
      <v-row align="center" no-gutters>
        <v-col>
          <div class="d-flex align-center">
            <h4 class="text-h4 mr-2">{{ $t('accountTab.dataSourceConnection') }}</h4>
            <!-- <h3 class="text-h6 font-weight-medium mr-2">DataSource 연동</h3> -->
            <v-chip 
              x-small 
              color="orange" 
              text-color="white"
              class="mr-2 text-caption"
              style="font-size: 11px;"
              density="compact"
            >
              <v-icon small left>mdi-flask</v-icon>
              {{ $t('accountTab.experimentalFeature') }}
            </v-chip>
            <v-chip 
              :color="isUseDataSource ? 'success' : 'grey'" 
              :text-color="isUseDataSource ? 'white' : 'white'"
              x-small
              density="compact"
              class="mr-2 text-caption"
              style="font-size: 11px;"
            >
              {{ isUseDataSource ? 'ON' : 'OFF' }}
            </v-chip>
          </div>
          <p class="text-body-2 text--secondary ma-0 mt-1">
            {{ isUseDataSource ? $t('accountTab.experimentalFeatureExplanationOn') : $t('accountTab.experimentalFeatureExplanationOff') }}
          </p>
        </v-col>
        <v-col cols="auto">
          <v-switch
            v-model="isUseDataSource"
            color="primary"
            hide-details
            @change="toggleDataSourceUsage"
          ></v-switch>
        </v-col>
      </v-row>

      <!-- 실험 기능 안내 -->
      <v-divider class="my-3"></v-divider>
      <v-alert
        dense
        outlined
        type="info"
        color="gray"
      >
        <v-row class="ma-0 pa-0">
          <!-- <v-icon color="orange" class="mr-2">mdi-information-outline</v-icon> -->
          <span class="text-body-2">
            <strong>{{ $t('accountTab.experimentalFeature') }}:</strong> {{ $t('accountTab.experimentalFeatureWarning') }}
          </span>
        </v-row>
      </v-alert>
    </v-card>

    <!-- 데이터소스 추가 버튼 -->
    <v-row class="ma-0 pa-0 mb-4">
      <v-spacer></v-spacer>
      <v-btn 
      color="primary"
        variant="flat"
        rounded
        @click="openAddDialog"
        :disabled="!isUseDataSource"
      >
        <v-icon class="mr-2" style="padding-top: 3px;">mdi-plus</v-icon>
        {{ $t('accountTab.addConnectionInfo') }}
      </v-btn>
    </v-row>

    <!-- 데이터소스 다이얼로그 -->
    <v-dialog v-model="dialog" max-width="800" persistent>
      <v-card>
        <v-row class="ma-0 pa-0" align="center">
          <v-card-title class="headline">
            <!-- <v-icon left color="primary">mdi-database-plus</v-icon> -->
            <h2 class="text-h4 text-grey-darken-2">{{ $t('accountTab.addConnectionInfo') }}</h2>
            <v-spacer></v-spacer>
          </v-card-title>
          <v-chip small color="orange" text-color="white" class="ma-2">
            <v-icon small left>mdi-flask</v-icon>
            {{ $t('accountTab.experimentalFeature') }}
          </v-chip>
        </v-row>

        <v-card-text max-height="500" style="overflow-y: auto;">
          <v-text-field 
            v-model="newDataSource.name" 
            label="Name" 
            outlined
            dense
          />

          <!-- Method + Endpoint -->
          <v-row>
            <v-col cols="12">
              <v-text-field 
                v-model="newDataSource.endpoint" 
                label="URL" 
                outlined
                dense
              />
            </v-col>
          </v-row>

          <!-- Headers -->
          <div class="mt-4">
            <h4 class="text-subtitle-1 mb-2">
              <v-icon left small>mdi-format-header-1</v-icon>
              Headers:
            </h4>
            <v-row 
              v-for="(header, idx) in newDataSource.headers" 
              :key="'header-'+idx" 
              align="center"
              no-gutters
            >
              <v-col cols="5">
                <v-text-field 
                  v-model="header.key" 
                  label="Header Name"
                  outlined
                  dense
                />
              </v-col>
              <v-col cols="5" class="ml-sm-2">
                <v-text-field 
                  v-model="header.value" 
                  label="Header Value"
                  outlined
                  dense
                />
              </v-col>
              <v-col cols="2" sm="1" class="text-center pl-sm-2 mt-n5">
                <v-btn
                  :disabled="newDataSource.headers.length === 1"
                  icon
                  variant="text"
                  class="text-medium-emphasis"
                  @click="removeHeader(idx)"
                >
                  <TrashIcon size="24" style="color:#666;"/>
                </v-btn>
              </v-col>
            </v-row>
            <v-btn 
            color="secondary" 
              variant="flat"
              rounded
              class="mt-2" 
              @click="addHeader"
            >
              <v-icon class="mr-2" style="padding-top: 3px;">mdi-plus</v-icon>
              {{ $t('accountTab.addHeader') }}
            </v-btn>
          </div>
        </v-card-text>
        <v-row class="ma-0 pa-0 mt-2 pb-4">
            <v-spacer></v-spacer>
            <v-btn @click="dialog = false" color="grey" variant="flat" rounded class="mr-2">{{ $t('accountTab.cancel') }}</v-btn>
            <v-btn @click="saveDataSource" :loading="saving" color="primary" variant="flat" rounded class="mr-4">{{ $t('accountTab.save') }}</v-btn>
        </v-row>
      </v-card>
    </v-dialog>

    <!-- 저장된 데이터소스 리스트 -->
    <div :class="{ 'datasource-disabled': !isUseDataSource }">
      <v-card 
        class="mt-4" 
        elevation="2" 
        v-for="(ds, index) in dataSources" 
        :key="index"
      >
        <v-card-text class="pa-4">
          <div class="d-flex align-center mb-3">
            <v-icon color="primary" class="mr-2">mdi-database</v-icon>
            <h4 class="text-h6">{{ ds.name }}</h4>
            <v-spacer></v-spacer>
            <v-chip small :color="ds.method === 'GET' ? 'success' : 'primary'" dark>
              {{ ds.method }}
            </v-chip>
          </div>

          <v-divider class="mb-3"></v-divider>

          <div class="mb-2">
            <strong class="text-subtitle-2">{{ $t('accountTab.url') }}:</strong>
            <code class="ml-2 pa-1 grey lighten-4 rounded">{{ ds.endpoint }}</code>
          </div>

          <div class="mb-2" v-if="ds.headers && ds.headers.length > 0">
            <strong class="text-subtitle-2">{{ $t('accountTab.key') }}:</strong>
            <div class="ml-4 mt-1">
              <v-chip 
                v-for="(h, i) in ds.headers" 
                :key="'h-'+i"
                x-small
                class="mr-1 mb-1"
                outlined
              >
                {{ h.key }}: {{ '*'.repeat(h.value.length) }}
              </v-chip>
            </div>
          </div>

          <div v-if="ds.auth.enabled" class="mb-2">
            <strong class="text-subtitle-2">{{ $t('accountTab.authentication') }}:</strong>
            <v-chip x-small color="orange" text-color="white" class="ml-2">
              <v-icon x-small left>mdi-lock</v-icon>
              {{ ds.auth.username }} / (•••)
            </v-chip>
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn 
            icon 
            small
            @click="editDataSource(ds)" 
            :disabled="!isUseDataSource"
            color="primary"
          >
            <v-icon>mdi-pencil</v-icon>
          </v-btn>
          <v-btn 
            icon 
            small
            @click="deleteDataSource(ds)" 
            :disabled="!isUseDataSource"
            color="error"
          >
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>
  </div>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
  name: 'DataSourceTab',
  data() {
    return {
      dialog: false,
      isEditMode: false,
      isUseDataSource: false, // ✅ DataSource 사용 여부
      newDataSource: {
        uuid: null,  // ✅ uuid 저장
        name: '',
        method: 'GET',
        endpoint: '',
        headers: [ { key: '', value: '' } ],
        parameters: [ { key: '', value: '' } ],
        auth: {
          username: '',
          password: '',
          enabled: false
        }
      },
      dataSources: []
    }
  },
  mounted() {
    this.loadDataSourceUsage();
    this.loadDataSourceList();
  },
  methods: {
    // ✅ localStorage에서 DataSource 사용 여부 로드
    loadDataSourceUsage() {
      const stored = localStorage.getItem('isUseDataSource');
      if (stored !== null) {
        this.isUseDataSource = stored === 'true';
      } else {
        // 기본값은 true
        this.isUseDataSource = true;
        localStorage.setItem('isUseDataSource', 'true');
      }
      console.log('[ConnectionInfoTab] DataSource 사용 여부 로드됨:', this.isUseDataSource);
    },

    // ✅ DataSource 사용 여부 토글
    toggleDataSourceUsage() {
      const newValue = this.isUseDataSource.toString();
      localStorage.setItem('isUseDataSource', newValue);
      console.log('[ConnectionInfoTab] DataSource 사용 여부 변경됨:', newValue);
      
      // 토글 피드백
      this.$nextTick(() => {
        const message = this.isUseDataSource 
          ? this.$t('accountTab.dataSourceConnectionOn') 
          : this.$t('accountTab.dataSourceConnectionOff');
        
        // Vuetify snackbar가 있다면 사용
        if (this.$root.$children[0].$refs?.snackbar) {
          this.$root.$children[0].$refs.snackbar.show(message);
        } else {
          console.log('[ConnectionInfoTab]', message);
        }
      });
    },

    async loadDataSourceList() {
      try {
        const res = await backend.getDataSourceList();
        if (res && Array.isArray(res)) {
          this.dataSources = res.map(item => ({
            uuid: item.uuid,
            name: item.key,
            method: item.value?.method ?? 'GET',
            endpoint: item.value?.endpoint ?? '',
            headers: item.value?.headers ?? [],
            parameters: item.value?.parameters ?? [],
            auth: item.value?.auth ?? {
              enabled: false,
              username: '',
              password: ''
            }
          }));
        }
      } catch (err) {
        console.error('데이터소스 목록 가져오기 실패:', err.message);
      }
    },
    openAddDialog() {
      if (!this.isUseDataSource) {
        console.warn('[ConnectionInfoTab] DataSource가 비활성화되어 있습니다.');
        return;
      }
      this.isEditMode = false;  // ✅ 새로 추가면 edit 모드 꺼줌
      this.newDataSource = {
        uuid: null,
        name: '',
        method: 'GET',
        endpoint: '',
        headers: [ { key: '', value: '' } ],
        parameters: [ { key: '', value: '' } ],
        auth: {
          username: '',
          password: '',
          enabled: false
        }
      };
      this.dialog = true;
    },
    addHeader() {
      this.newDataSource.headers.push({ key: '', value: '' });
    },
    removeHeader(index) {
      this.newDataSource.headers.splice(index, 1);
    },
    addParameter() {
      this.newDataSource.parameters.push({ key: '', value: '' });
    },
    removeParameter(index) {
      this.newDataSource.parameters.splice(index, 1);
    },
    addAuth() {
      this.newDataSource.auth.enabled = true;
    },
    removeAuth() {
      this.newDataSource.auth.enabled = false;
      this.newDataSource.auth.username = '';
      this.newDataSource.auth.password = '';
    },
    async saveDataSource() {
      if (!this.newDataSource.name || !this.newDataSource.endpoint) {
        alert('Name과 Endpoint는 필수입니다.');
        return;
      }

      // ✅ backend에 넘길 구조
      const payload = {
        key: this.newDataSource.name,
        value: {
          method: this.newDataSource.method,
          endpoint: this.newDataSource.endpoint,
          headers: this.newDataSource.headers,
          parameters: this.newDataSource.parameters,
          auth: this.newDataSource.auth
        },
        version: 1
      };

      if (this.isEditMode) {
        // ✅ 수정일 경우 uuid 포함
        payload.uuid = this.newDataSource.uuid;

        await backend.updateDataSource(payload);

        // ✅ 리스트에서 기존 데이터 덮어쓰기
        const idx = this.dataSources.findIndex(ds => ds.uuid === this.newDataSource.uuid);
        if (idx !== -1) {
          this.dataSources.splice(idx, 1, JSON.parse(JSON.stringify(this.newDataSource)));
        }

      } else {
        await backend.addDataSource(payload);

        // ✅ 새로 추가
        const newItem = { ...this.newDataSource };
        // uuid는 DB에서 auto-gen이라면 생략 가능 (아니면 응답에서 받아서 추가)
        this.dataSources.push(newItem);
      }

      this.dialog = false;
    },
    editDataSource(ds) {
      this.isEditMode = true;  // ✅ 수정모드 ON
      this.newDataSource = JSON.parse(JSON.stringify(ds));
      this.dialog = true;
    },
    deleteDataSource(ds) {
      const idx = this.dataSources.indexOf(ds);
      if (idx > -1) this.dataSources.splice(idx, 1);
      backend.deleteDataSource(ds);
    }
  }
}
</script>

<style scoped>
.text-body-2 {
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: normal !important;
    line-height: 1.4 !important;
    overflow-wrap: break-word !important;
}

.datasource-disabled {
  opacity: 0.6;
  pointer-events: none;
  filter: grayscale(0.3);
}

code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
}

.text-none {
  text-transform: none !important;
}
</style>
