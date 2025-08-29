<template>
    <!-- ---------------------------------------------- -->
    <!-- search -->
    <!-- ------------------------------------------------>
    <v-menu :close-on-content-click="false" class="search_popup">
        <template v-slot:activator="{ props }">
            <div v-bind="props">
                <div>
                    <div class="d-flex align-center flex-fill border border-borderColor header-search rounded-pill px-5 ">
                        <Icons :icon="'magnifer-linear'" :size="22" />
                        <v-text-field v-model="searchKeyword" variant="plain" density="compact"
                            class="position-relative pt-0 ml-3 custom-placeholer-color" 
                            :placeholder="$t('headerMenu.search')"
                            single-line hide-details
                            @keyup.enter="search"
                        ></v-text-field>
                    </div>
                </div>
            </div>
        </template>

        <!-- Search Result -->
        <v-sheet class="main-search-box" elevation="10" rounded="md">
            <h5 class="text-h5 mt-3 px-5 pb-3">검색 결과</h5>
            <div style="max-height: 500px; overflow: auto;">
                <v-list v-if="!searching" class="pt-0 pb-5" lines="two">
                    <v-list-subheader>검색하고자 하는 키워드 입력 후 엔터를 눌러주세요.</v-list-subheader>
                </v-list>
                <v-list v-else-if="searchKeyword.length > 0 && searchResult.length > 0" class="pt-0 pb-5" lines="two">
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
                <v-list v-else class="pt-0 pb-5" lines="two">
                    <v-list-subheader>검색 결과가 없습니다.</v-list-subheader>
                </v-list>
            </div>
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

