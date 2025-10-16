<template>
    <v-col style="height: 100%;">
        <v-alert v-if="infoDetail" color="#2196F3" variant="outlined">
            <template v-slot:title>
                <Icons style="padding-left:-5px;" :icon="'info-line'" :size="32" :color="'#2196F3'"/>
            </template>
            <small style="white-space: pre-line; font-size:14px;">
                {{ infoDetail }}
            </small>
        </v-alert>
    </v-col>
</template>

<script>
export default {
    name: 'InfoAlert',
    props: {
        howToUseInfo: {
            type: Object,
            default: null
        }
    },
    computed: {
        infoDetail() {
            if(this.howToUseInfo && this.howToUseInfo.text){
                const text = this.howToUseInfo.text;
                // 국제화 키가 존재하는지 확인
                const translated = this.$t(text);
                // 번역이 키 그대로 반환되면 하드코딩된 텍스트로 사용
                return translated !== text ? translated : text;
            }
            return '';
        }
    }
}
</script>