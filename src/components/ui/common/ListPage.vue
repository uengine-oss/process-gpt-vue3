<template>
    <div class="list-view">
      <!-- 헤더 -->
      <v-row>
          <!-- 타이틀 -->
          <v-col style="max-width: fit-content; margin-right: 20px;">
            <h2>{{ title }}</h2>
          </v-col>

          <!-- 검색 및 필터 -->
          <v-col style="padding-bottom: 0;">
            <v-row style="align-items: center;">
              <!-- 검색 -->
              <v-text-field
                v-if="searchConfig.show"
                v-model="searchWord"
                :loading="loading"
                :label="searchConfig.label"
                variant="solo"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                hide-details
                single-line
                dense
                style="min-width: 100px; max-width: 300px; margin-right: 10px;"
                @click:append-inner="search()"
              ></v-text-field>

              <!-- 필터 -->
              <v-menu
                v-model="showFilter"
                :close-on-content-click="false"
                location="end"
              >
                <template v-slot:activator="{ props }">
                  <v-icon v-bind="props" size="large">{{ isFilter ? 'mdi-filter' : 'mdi-filter-outline' }}</v-icon>
                </template>

                <v-card min-width="300" v-if="!isLoading">
                  <v-list>
                    <v-list-item>
                      <v-card flat>
                        <v-card-title> 기간 설정 </v-card-title>
                        <v-divider></v-divider>
                          <v-card-text style="margin-top: 5px; padding: 0;">
                            <v-col>
                              <!-- 시작일 -->
                              <v-menu
                                v-model="showStartFilter"
                                :close-on-content-click="false"
                                transition="scale-transition"
                                location="end"
                                offset-y
                                min-width="290px"
                              >
                                <template v-slot:activator="{ props }">
                                  <v-text-field
                                    v-model="copyFilter.period.startDate"
                                    label="시작일"
                                    prepend-inner-icon="mdi-calendar"
                                    readonly
                                    clearable
                                    v-bind="props"
                                    @click="showStartFilter = true"
                                  ></v-text-field>
                                </template>
                                <v-date-picker
                                  v-model="startDateByPicker"
                                  @update:model-value="(value) => { startDateByPicker = value; showStartFilter = false; }"
                                ></v-date-picker>
                              </v-menu>

                              <!-- 종료일 -->
                              <v-menu
                                v-model="showEndFilter"
                                :close-on-content-click="false"
                                transition="scale-transition"
                                offset-y
                                min-width="290px"
                              >
                                <template v-slot:activator="{ props }">
                                  <v-text-field
                                    v-model="copyFilter.period.endDate"
                                    label="종료일"
                                    prepend-inner-icon="mdi-calendar"
                                    readonly
                                    clearable
                                    v-bind="props"
                                    hide-details
                                  ></v-text-field>
                                </template>
                                <v-date-picker
                                  v-model="endDateByPicker"
                                  @update:model-value="(value) => { endDateByPicker = value; showEndFilter = false; }"
                                ></v-date-picker>
                              </v-menu>
                          </v-col>
                        </v-card-text>
                      </v-card>
                    </v-list-item>
                    <v-list-item v-if="filterConfig" v-for="key in Object.keys(filterConfig)" :key="key">
                        <v-card flat>
                          <v-card-title> {{ filterConfig[key].label }} </v-card-title>
                          <v-divider></v-divider>
                          <v-card-text style="margin-top: 10px; padding: 0;">
                            <v-select
                              v-model="copyFilter[key]"
                              :label="filterConfig[key].label"
                              :items="filterConfig[key].options"
                              item-title="text"
                              item-value="value"
                              :multiple="filterConfig[key].multiple"
                            ></v-select>
                          </v-card-text>
                        </v-card>
                    </v-list-item>
                  </v-list>
                </v-card>
              </v-menu>
            </v-row>
          </v-col>
      </v-row>
   
      <v-infinite-scroll :height="config.height" @load="load">
        <template v-for="(item, index) in items" :key="item">
          <div class="pa-2">
            <slot name="item-row" :item="item"></slot>
          </div>
        </template>
        <template v-slot:empty>
          <v-alert type="warning">더 이상 데이터가 없습니다.</v-alert>
        </template>
      </v-infinite-scroll>
    </div>
</template>
  
<script>
import StatusChip from '@/components/ui/common/StatusChip.vue'
export default {
    name: 'ListView',    
    components: {
        StatusChip
    },
    props: {
      type: {
        type: String,
        required: true
      },
       // 타이틀
      title: {
        type: String,
        default: ''
      },
      // 리스트 
      items: {
        type: Array,
        required: true
      },
      // 로딩 상태
      loading: {
        type: Boolean,
        default: false
      },
      // 설정
      config: {
        type: Object,
        required: true
      },
      // 검색 설정
      searchConfig: {
        type: Object,
        required: true
      },
      // 필터 설정
      filterConfig: {
        type: Object,
        required: true
      },
      // 필터 값
      filter: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        searchWord: '',
        showFilter: false,
        showStartFilter: false,
        showEndFilter: false,
        isLoading: true,
        
        // temp filter value
        copyFilter: null,
        startDateByPicker: null,
        endDateByPicker: null,
        ref: null
      }
    },
    computed:{
       isFilter(){
          return this.showFilter;
       }
    },
    watch: {
      searchWord: {
        handler: _.debounce(function(value) {
          this.search(value);
        }, 1000),
      },
      showFilter: {
        handler(newVal, oldVal){
          if(newVal){
            this.openFilter()
          } else {
            this.closeFilter()
          }
        }
      },
      "startDateByPicker": {
        handler(newVal, oldVal){
          if(newVal) {
            this.copyFilter.period.startDate =  this.formatDateToYYYYMMDD(newVal)
          }
          
        },
      },
      "endDateByPicker": {
        handler(newVal, oldVal){
          if(newVal) {
            this.copyFilter.period.endDate = this.formatDateToYYYYMMDD(newVal)
          }
        },
      },
      
    },
    methods: {
      load({ done }) {
        this.ref = done
        this.$emit('load', done);
      },
      search(word) {
        if(!this.searchConfig.show) return;
        this.resetScroll();
        this.$emit('search', word);
      },
      handleRowClick(event, item) {
        this.$emit('row-click', event, item);
      },
      openFilter(){
        this.isLoading = true
        this.copyFilter = JSON.parse(JSON.stringify(this.filter))

        if(this.copyFilter.period.startDate) this.startDateByPicker = new Date(this.copyFilter.period.startDate)
        if(this.copyFilter.period.endDate)   this.endDateByPicker = new Date(this.copyFilter.period.endDate)
        this.isLoading = false
      },
      closeFilter(){
        if(JSON.stringify(this.filter) === JSON.stringify(this.copyFilter)) return;

        this.resetScroll();
        this.$emit('filter', this.copyFilter)
      },
      formatDateToYYYYMMDD(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
      // 초기화 메서드
      resetScroll() {
        if (this.ref) this.ref('ok')
      },
    }
    
  }
  </script>