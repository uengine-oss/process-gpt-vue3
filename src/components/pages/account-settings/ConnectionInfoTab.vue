<template>
  <div>
    <!-- 데이터소스 추가 버튼 -->
    <div class="d-flex justify-end mb-4">
      <v-btn color="primary" elevation="2" @click="openAddDialog">
        {{ $t('accountTab.addConnectionInfo') }}
      </v-btn>
    </div>

    <!-- 데이터소스 다이얼로그 -->
    <v-dialog v-model="dialog" max-width="700">
      <v-card>
        <v-card-title>
          <span class="text-h5">{{ $t('accountTab.addConnectionInfo') }}</span>
        </v-card-title>
        <v-card-text max-height="500" style="overflow-y: auto;">
          <v-text-field v-model="newDataSource.name" label="Name" />

          <!-- Method + Endpoint -->
          <v-row>
            <v-col cols="4">
              <v-select
                v-model="newDataSource.method"
                :items="['GET', 'POST', 'PUT', 'DELETE', 'PATCH']"
                label="Method"
              />
            </v-col>
            <v-col cols="8">
              <v-text-field v-model="newDataSource.endpoint" label="Endpoint" />
            </v-col>
          </v-row>

          <!-- Headers -->
          <div class="mt-4">
            <strong>Headers:</strong>
            <v-row v-for="(header, idx) in newDataSource.headers" :key="'header-'+idx" align="center">
              <v-col cols="5">
                <v-text-field v-model="header.key" label="Header Name"/>
              </v-col>
              <v-col cols="5">
                <v-text-field v-model="header.value" label="Header Value"/>
              </v-col>
              <v-col cols="2">
                <v-btn icon @click="removeHeader(idx)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>
            <v-btn small color="secondary" class="mt-2" @click="addHeader">{{ $t('accountTab.addHeader') }}</v-btn>
          </div>

          <!-- Parameters -->
          <div class="mt-4">
            <strong>{{ $t('accountTab.parameters') }}:</strong>
            <v-row v-for="(param, idx) in newDataSource.parameters" :key="'param-'+idx" align="center">
              <v-col cols="5">
                <v-text-field v-model="param.key" label="Parameter Name"/>
              </v-col>
              <v-col cols="5">
                <v-text-field v-model="param.value" label="Parameter Value"/>
              </v-col>
              <v-col cols="2">
                <v-btn icon @click="removeParameter(idx)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>
            <v-btn small color="secondary" class="mt-2" @click="addParameter">{{ $t('accountTab.addParameter') }}</v-btn>
          </div>

          <!-- Authentication -->
          <div class="mt-4">
            <strong>{{ $t('accountTab.authentication') }}:</strong>
            <div v-if="newDataSource.auth.enabled">
              <v-row align="center">
                <v-col cols="5">
                  <v-text-field v-model="newDataSource.auth.username" label="Username" />
                </v-col>
                <v-col cols="5">
                  <v-text-field v-model="newDataSource.auth.password" label="Password" type="password"/>
                </v-col>
                <v-col cols="2">
                  <v-btn icon @click="removeAuth">
                    <v-icon>mdi-close</v-icon>
                  </v-btn>
                </v-col>
              </v-row>
            </div>
            <div v-else>
              <v-btn small color="secondary" @click="addAuth">{{ $t('accountTab.addAuthentication') }}</v-btn>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="saveDataSource">{{ $t('accountTab.save') }}</v-btn>
          <v-btn color="secondary" @click="dialog = false">{{ $t('accountTab.cancel') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 저장된 데이터소스 리스트 -->
    <v-card class="mt-4 pa-4" v-for="(ds, index) in dataSources" :key="index">
      <div><strong>{{ $t('accountTab.name') }}:</strong> {{ ds.name }}</div>
      <div><strong>{{ $t('accountTab.method') }}:</strong> {{ ds.method }}</div>
      <div><strong>{{ $t('accountTab.endpoint') }}:</strong> {{ ds.endpoint }}</div>

      <div><strong>{{ $t('accountTab.headers') }}:</strong>
        <div v-for="(h, i) in ds.headers" :key="'h-'+i">
          {{ h.key }}: {{ '*'.repeat(h.value.length) }}
        </div>
      </div>


      <div><strong>{{ $t('accountTab.parameters') }}:</strong>
        <div v-for="(p, i) in ds.parameters" :key="'p-'+i">
          {{ p.key }}: {{ p.value }}
        </div>
      </div>

      <div v-if="ds.auth.enabled"><strong>{{ $t('accountTab.authentication') }}:</strong>
        {{ $t('accountTab.username') }}: {{ ds.auth.username }} / {{ $t('accountTab.password') }}: (•••)
      </div>

      <v-row align="center" class="mt-2">
        <v-spacer></v-spacer>
        <v-btn icon @click="editDataSource(ds)">
          <v-icon>mdi-pencil</v-icon>
        </v-btn>
        <v-btn icon @click="deleteDataSource(ds)">
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </v-row>
    </v-card>
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
      isEditMode: false,  // ✅ 수정 모드 여부 플래그
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
    this.loadDataSourceList();
  },
  methods: {
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
/* 필요하면 스타일 조정 */
</style>
