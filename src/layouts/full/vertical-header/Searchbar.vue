<template>
    <!-- ---------------------------------------------- -->
    <!-- search -->
    <!-- ------------------------------------------------>
    <v-menu :close-on-content-click="false" class="search_popup">
        <template v-slot:activator="{ props }">
            <div v-bind="props">
                <div class="hidden-md-and-down">
                    <div class="d-flex align-center flex-fill border border-borderColor header-search rounded-pill px-5 ">
                        <Icons :icon="'magnifer-linear'" :size="22" />
                        <v-text-field v-model="searchKeyword" variant="plain" density="compact"
                            class="position-relative pt-0 ml-3 custom-placeholer-color" placeholder="검색"
                            single-line hide-details
                            @keyup.enter="search"
                        ></v-text-field>
                    </div>
                </div>
                <v-btn icon variant="text" class="custom-hover-primary ml-sm-3 search hidden-md-and-up" size="small">
                    <Icons :icon="'magnifer-linear'" :size="22" />
                </v-btn>
            </div>
        </template>

        <!-- Search Result -->
        <v-sheet width="360" elevation="10" rounded="md">
            <h5 class="text-h5 mt-3 px-5 pb-3">검색 결과</h5>
            <perfect-scrollbar style="height: 380px">
                <v-list v-if="searchResult.length == 0 && searchKeyword.length == 0" class="pt-0 pb-5" lines="two">
                    <v-list-item>
                        <v-list-item-title>검색어를 입력해주세요.</v-list-item-title>
                    </v-list-item>
                </v-list>
                <v-list v-else-if="searchResult.length > 0" class="pt-0 pb-5" lines="two">
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
                <v-list v-else-if="searchKeyword.length > 0 && !searching" class="pt-0 pb-5" lines="two">
                    <v-list-item>
                        <v-list-item-title></v-list-item-title>
                    </v-list-item>
                </v-list>
                <v-list v-else class="pt-0 pb-5" lines="two">
                    <v-list-item>
                        <v-list-item-title>검색 결과가 없습니다.</v-list-item-title>
                    </v-list-item>
                </v-list>
            </perfect-scrollbar>
        </v-sheet>
    </v-menu>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        searchKeyword: "",
        searchResult: [],
        searching: false
    }),
    watch: {
        searchKeyword(newVal, oldVal) {
            if (newVal.length == 0 || (newVal != oldVal && !this.searching)) {
                this.searchResult = [];
            }
        },
        searchResult: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    // console.log(newVal);
                }
            }
        }
    },
    methods: {
        async search() {
            if (this.searchKeyword.length == 0) {
                this.searching = false;
                this.searchResult = [];
                return;
            }
            this.searching = true;
            this.searchResult = [];

            await backend.search(this.searchKeyword, (updated) => {
                this.searchResult = updated;
            });
        },
        summarize(text) {
            if (text && text.length > 0) {
                const startIndex = text.indexOf(this.searchKeyword);
                if (startIndex !== -1) {
                    const endIndex = Math.min(startIndex + 40, text.length);
                    return text.substring(startIndex, endIndex) + (endIndex < text.length ? '...' : '');
                }
                return text.length > 40 ? text.substring(0, 40) + '...' : text;
            }
            return '';
        }
    },
}
</script>

