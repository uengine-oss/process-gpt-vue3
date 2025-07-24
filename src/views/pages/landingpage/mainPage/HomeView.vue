<template>
    <v-container class="main-page-container">
        <v-row>
            <v-col cols="12">
                <HeroSection />
                <IntroSection />
                <!-- <DemoSection /> -->
                <WhySection />
                <!-- <ConsultingSection /> -->
                <!-- <FeaturesSection /> -->
                <HowSection />
                <SpecialSection />
                <!-- <CasesSection /> -->
                <!-- <TechSection /> -->
                <ExtensibilitySection />
                <CTASection />
                <DownloadSection />
                <!-- <v-card>
                    <v-card-title>Vue 3 + Vuetify 3</v-card-title>
                    <v-card-text>
                        Welcome to your new Vue 3 + Vuetify 3 application!
                    </v-card-text>
                    <v-card-actions>
                        <v-btn
                            color="primary"
                            @click="$router.push('/marketplace')"
                        >
                            Marketplace로 이동
                        </v-btn>
                    </v-card-actions>
                </v-card> -->
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import HeroSection from './sections/HeroSection.vue'
import IntroSection from './sections/IntroSection.vue'
// import DemoSection from './sections/DemoSection.vue'
import WhySection from './sections/WhySection.vue'
// import ConsultingSection from './sections/ConsultingSection.vue'
// import FeaturesSection from './sections/FeaturesSection.vue'
import HowSection from './sections/HowSection.vue'
import SpecialSection from './sections/SpecialSection.vue'
// import CasesSection from './sections/CasesSection.vue'
// import TechSection from './sections/TechSection.vue'
import ExtensibilitySection from './sections/ExtensibilitySection.vue'
import CTASection from './sections/CTASection.vue'
import DownloadSection from './sections/DownloadSection.vue'

export default {
    name: 'HomeView',
    components: {
        HeroSection,
        IntroSection,
        // DemoSection,
        WhySection,
        // ConsultingSection,
        // FeaturesSection,
        HowSection,
        SpecialSection,
        // CasesSection,
        // TechSection,
        ExtensibilitySection,
        CTASection,
        DownloadSection
    }
}
</script> 

<style>
.main-page-container {
    max-width: 100% !important;
    padding-top: 70px;
}

.main-page-container,
.main-page-container .v-row,
.main-page-container .v-col{
    margin: 0;
    padding: 0;

}
</style>