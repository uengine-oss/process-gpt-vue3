<script setup>
import { SearchIcon } from 'vue-tabler-icons';
import { searchSugg } from '@/_mockApis/headerData';
import { Icon } from '@iconify/vue';
</script>

<template>
    <!-- ---------------------------------------------- -->
    <!-- search1 -->
    <!-- ------------------------------------------------>
    <v-menu :close-on-content-click="false" class="search_popup">
        <template v-slot:activator="{ props }">
            <div class="" v-bind="props">
                <div class="hidden-md-and-down">
                    <div class="d-flex align-center flex-fill border border-borderColor header-search rounded-pill px-5 ">
                        <Icon icon="solar:magnifer-linear" height="22" width="22" />
                        <v-text-field v-model="searchKeyword" variant="plain" density="compact"
                            class="position-relative pt-0 ml-3 custom-placeholer-color" placeholder="검색"
                            single-line hide-details
                        ></v-text-field>
                    </div>
                </div>
                <v-btn icon variant="text" class="custom-hover-primary ml-sm-3 search hidden-md-and-up" size="small">
                    <Icon icon="solar:magnifer-linear" height="22" width="22" />
                </v-btn>
            </div>
        </template>

        <!-- Search Result -->
        <v-sheet width="360" elevation="10" rounded="md">
            <h5 class="text-h5 mt-3 px-5 pb-3">검색 결과</h5>
            <perfect-scrollbar style="height: 380px">
                <v-list class="pt-0 pb-5" lines="two">
                    <div v-for="item in searchResult" :key="item.type" class="py-1">
                        <v-divider inset></v-divider>
                        <v-list-subheader class="text-caption">{{ item.header }}</v-list-subheader>
                        <v-list-item :value="item" v-for="(item, index) in item.list" :key="index" :to="item.href"
                            color="primary" class="px-5 py-2">
                            <h6 class="text-subtitle-1 font-weight-medium mb-1">{{ item.title }}</h6>
                            <p class="text-subtitle-2 text-medium-emphasis">{{ summarize(item.matches[0]) }}</p>
                        </v-list-item>
                    </div>
                </v-list>
            </perfect-scrollbar>
        </v-sheet>
    </v-menu>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

export default {
    data: () => ({
        searchKeyword: "",
        searchResult: []
    }),
    watch: {
        async searchKeyword(newVal) {
            this.searchResult = []
            if (newVal.length > 0) {
                await this.search(newVal)
            }
        }
    },
    methods: {
        async search(keyword) {
            this.searchResult = await storage.search(keyword)
        },
        summarize(text) {
            const startIndex = text.indexOf(this.searchKeyword);
            if (startIndex !== -1) {
                const endIndex = Math.min(startIndex + 40, text.length);
                return text.substring(startIndex, endIndex) + (endIndex < text.length ? '...' : '');
            }
            return text.length > 40 ? text.substring(0, 40) + '...' : text;
        }
    },
}
</script>

