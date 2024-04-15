<template>
    <v-card
    class="mx-auto my-8"
    elevation="16"
    max-width="400"
    >
        <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important;">{{ "NewForm" }}</v-card-title>
        <v-btn icon style="position:absolute; right:5px; top:5px;" @click="$emit('onClose')">
            <v-icon>mdi-close</v-icon>
        </v-btn>

        <v-card-text>
            <v-col>
                <v-text-field v-model="infoToSave.id" label="ID"
                    :rules="[v => !!v || 'ID is required']" required></v-text-field>
                <v-text-field v-model="infoToSave.name" label="Name" 
                    :rules="[v => !!v || 'Name is required']" required></v-text-field>
            </v-col>
        </v-card-text>

        <v-card-actions style="justify-content: right;">
            <v-btn @click="$emit('onSave', infoToSave)"> SAVE </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
export default {
    name: 'FormDesignSavePanel',
    emits: [
        "onClose",
        "onSave"
    ],
    data: () => ({
        infoToSave: {
            id: "",
            name: ""
        }
    }),
};
</script>
