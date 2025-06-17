<template>
    <v-card elevation="10" class="mb-2">
        <v-card-item>
            <h5 class="text-h5">{{ $t('accountTab.profileImageChange') }}</h5>
            <div class="text-center mt-6 mb-6">
                <v-avatar size="120">
                    <img :src="profile || ''" height="120" alt="image" />
                </v-avatar>
            </div>
            <div class="d-flex justify-center">
                <v-dialog width="650" v-model="imageDialog">
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" color="primary" class="mx-2" rounded="pill" text="이미지 선택">{{
                            $t('accountTab.imageSlect') }}</v-btn>
                    </template>

                    <v-card style="padding:30px;">
                        <v-row>
                            <v-col>
                                <v-row>
                                    <img v-for="(profileImage, name) in profileImages"
                                        @click="() => imageChange(profileImage)" class="change-profile-image"
                                        :key="name" :src="profileImage" width="100" height="100" alt="Mathew"
                                        style="border-radius: 50%; padding:10px;" />
                                </v-row>
                            </v-col>
                        </v-row>
                    </v-card>
                </v-dialog>
            </div>
            <div class="text-subtitle-1 text-grey100 text-center my-sm-8 my-6">
                {{ $t('accountTab.slectImageExplanation') }}
            </div>
        </v-card-item>
    </v-card>    
</template>

<script>
import { profileImages } from '@/components/pages/account-settings/profileImage';

export default {
    props: {
        modelValue: {
            type: String,
            required: true,
            default: ''
        }
    },
    data() {
        return {
            profile: '',
            imageDialog: false,
            profileImages
        }
    },
    watch: {
        modelValue: {
            handler(newVal) {
                this.profile = newVal;
            },
            deep: true
        },
        profile: {
            handler(newVal) {
                this.$emit('update:modelValue', newVal);
            },
            deep: true
        },
    },
    mounted() {
        this.profile = this.modelValue;
    },
    methods: {
        imageChange(image) {
            this.profile = image;
            this.imageDialog = false;
        }
    }
}
</script>