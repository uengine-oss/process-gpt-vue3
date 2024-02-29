<script>
import { defineComponent } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import StorageBase from '@/utils/StorageBase';

export default defineComponent({
  components: {
    FullCalendar,
  },
  data() {
    return {
      updateModalShow: false,
      editMode: false, 
      calendarOptions: {
        plugins: [
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin 
        ],
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        initialView: 'dayGridMonth',
        initialEvents: [], 
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,
        select: this.handleDateSelect,
        eventClick: this.handleEventClick,
        eventsSet: this.handleEvents,
        datesSet: this.handleDateSet,
        initialView: 'dayGridMonth',
        initialDate: null,
      },
      currentEvents: [],
      calendarKey: 0,
      selectedEvent: {},
      showColorPicker: false,
      colorItems: [
        {
          text: 'Red',
          value: '#EC4545'
        },
        {
          text: 'Blue',
          value: '#2196F3'
        },
        {
          text: 'Green',
          value: '#4CAF50'
        },
        {
          text: 'Yellow',
          value: '#FFEB3B'
        },
        {
          text: 'Purple',
          value: '#9C27B0'
        }
      ],
      calendarData: null,
      currentMonth: null,
    }
  },
  created() {},
  methods: {
    handleDateSet(info){
      const startDate = new Date(info.startStr);
      let currentMonth;
      let currentYear = startDate.getFullYear();

      if (startDate.getDate() === 1) {
        currentMonth = startDate.getMonth();
      } else {
        if (startDate.getMonth() === 11) {
          currentMonth = 0;
          currentYear += 1;
        } else {
          currentMonth = startDate.getMonth() + 1;
        }
      }

      const newCurrentMonth = `${currentYear}_${currentMonth < 9 ? `0${currentMonth + 1}` : currentMonth + 1}`;
      if (!this.currentMonth || this.currentMonth !== newCurrentMonth) {
        this.currentMonth = newCurrentMonth;
        this.setCalendar()
      }
    },
    async setCalendar(){
      this.storage = StorageBase.getStorage("supabase");
      let option = {
          key: "uid"
      }
      if(!this.calendarData){
        const res = await this.storage.getObject(`db://calendar/${localStorage.getItem('uid')}`, option);
        if(res && res.data){
            this.calendarData = res.data
        }
      } 
      if(this.calendarData) {
        if(this.calendarData[this.currentMonth]){
          this.calendarOptions.initialEvents = Object.values(this.calendarData[this.currentMonth])
        } else {
          this.calendarOptions.initialEvents = []
        }
        this.calendarOptions.initialDate = this.currentMonth.replace('_', "-")
      }
      this.calendarKey++;
    },
    uuid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    },
    handleWeekendsToggle() {
      this.calendarOptions.weekends = !this.calendarOptions.weekends 
    },
    handleDateSelect(selectInfo) {
      const title ='Please enter a new title for your event'
      const calendarApi = selectInfo.view.calendar
      calendarApi.unselect()
      if (title) {
        let data = {
          id: this.uuid(),
          title,
          start: selectInfo.startStr,
          end: selectInfo.endStr,
          allDay: selectInfo.allDay
        }
        calendarApi.addEvent(data)
        this.calendarOptions.initialEvents.push(data)
      }
      
    },
    handleEventClick(clickInfo) {
      let selectedEvent = this.calendarOptions.initialEvents.find(x => x.id == clickInfo.event.id)
      if(selectedEvent){
        this.selectedEvent = selectedEvent
      } else {
        this.selectedEvent = clickInfo.event
      }
      this.showColorPicker = false;
      this.updateModalShow = true;
    },
    handleEvents(events) {
      this.currentEvents = events;
    },
    async saveCalendar(option) {
      this.updateModalShow = false;
      this.editMode = false;

      const date = new Date(this.selectedEvent.start);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      if(option == 'update'){
        if(!this.calendarData){
          this.calendarData = {}
        }
        if(!this.calendarData[`${year}_${month}`]){
          this.calendarData[`${year}_${month}`] = {}
        }
        this.calendarData[`${year}_${month}`][this.selectedEvent.id] = this.selectedEvent;
      } else {
        delete this.calendarData[`${year}_${month}`][this.selectedEvent.id]
      }

      let calendarObj = {
          "uid": localStorage.getItem('uid'),
          "data": this.calendarData
      }
      await this.storage.putObject(`db://calendar`, calendarObj);
      this.calendarKey++;
    },
    updateEvent() {
      this.saveCalendar('update')
    },
    deleteEvent() {
      let eventIdx = this.calendarOptions.initialEvents.findIndex(x => x.id == this.selectedEvent.id);
      if (eventIdx !== -1) {
        this.calendarOptions.initialEvents.splice(eventIdx, 1);
      }
      this.saveCalendar('delete')
    },
    toggleEditMode() {
      this.editMode = !this.editMode; 
    },
  }
})

</script>

<template>
  <div class='demo-app'>
    <div class='demo-app-main '>
      <FullCalendar class='demo-app-calendar rounded-md' :options='calendarOptions' :key="calendarKey">
        <template v-slot:eventContent='arg'>
          <div class="text-subtitle-1 pa-1 text-truncate">{{ arg.event.title }}</div>
        </template>
      </FullCalendar>
      <v-dialog v-model="updateModalShow" max-width="500px">
        <v-card>
          <v-card-text>
            <div class="event-details-header">
              <h4 class="text-h4">Event Details</h4>
              <v-btn v-if="!editMode" icon @click="toggleEditMode" class="edit-button">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn v-else icon @click="toggleEditMode" class="edit-button">
                <v-icon>mdi-arrow-left</v-icon>
              </v-btn>
            </div>
            <div v-if="!editMode" class="event-details">
              <div class="event-detail-item">
                <span class="event-label">Title:</span>
                <span class="event-value">{{ selectedEvent.title }}</span>
              </div>
              <div class="event-detail-item">
                <span class="event-label">Start:</span>
                <span class="event-value">{{ selectedEvent.start }}</span>
              </div>
              <div class="event-detail-item">
                <span class="event-label">End:</span>
                <span class="event-value">{{ selectedEvent.end }}</span>
              </div>
              <div class="event-detail-item">
                <span class="event-label">Description:</span>
                <span class="event-value">{{ selectedEvent.description }}</span>
              </div>
            </div>
            <div v-if="editMode">
              <v-text-field
                v-model="selectedEvent.title"
                label="Event Title"
                outlined
              ></v-text-field>
              <v-text-field
                v-model="selectedEvent.start"
                label="Start Date"
                outlined
                type="datetime-local"
              ></v-text-field>
              <v-text-field
                v-model="selectedEvent.end"
                label="End Date"
                outlined
                type="datetime-local"
              ></v-text-field>
              <v-textarea
                v-model="selectedEvent.description"
                label="Description"
                outlined
              ></v-textarea>
              <v-select 
                v-model="selectedEvent.color" 
                label="Color" 
                :items="colorItems"
                item-title="text"
                item-value="value"
              >
                <template v-slot:append>
                  <v-btn icon @click="showColorPicker = !showColorPicker">
                    <v-icon :style="showColorPicker ? 'color: #2196F3':''">mdi-palette</v-icon>
                  </v-btn>
                </template>
              </v-select>
              <v-color-picker
                v-if="showColorPicker"
                v-model="selectedEvent.color"
                label="Custom Color"
                hide-inputs
                outlined
              ></v-color-picker>
              <div style="margin-top: 10px;">
                <v-btn style="margin-right: 5px;" color="primary" @click="updateEvent">Update</v-btn>
                <v-btn color="error" @click="deleteEvent">Delete</v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<style lang='css'>
.fc .fc-button-group>.fc-button {
  display: flex;
  align-items: center;
  padding: 6px 22px;
}

.fc .fc-button {
  font-size: 1rem;
  font-weight: 500;
  text-transform: capitalize
}

.fc .fc-button .fc-icon {
  font-size: 1.5em;
  vertical-align: unset;
}

.fc .fc-button-primary {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));

}

.fc .fc-button-primary:not(:disabled).fc-button-active,
.fc .fc-button-primary:not(:disabled):active {
  background-color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}

.fc .fc-button-primary:not(:disabled).fc-button-active:focus,
.fc .fc-button-primary:not(:disabled):active:focus {
  box-shadow: none;
}

.fc-theme-standard td,
.fc-theme-standard th {
  border: 1px solid rgba(var(--v-border-color), 1) !important;
}

.fc-theme-standard .fc-scrollgrid {
  border: 0 !important;
}

.fc-theme-standard th {
  border-bottom: 0 !important;
}

.fc-h-event {
  background-color: rgb(var(--v-theme-primary));
  border: 1px solid rgb(var(--v-theme-primary));
  display: block;
}

.fc .fc-col-header-cell-cushion {
  display: inline-block;
  padding: 10px 5px;
  font-size: 14px;
}

.fc-direction-ltr .fc-button-group>.fc-button:not(:last-child) {
  border-bottom-left-radius: 9999px;
  border-top-left-radius: 9999px;
}

.fc-direction-ltr .fc-button-group>.fc-button:not(:first-child) {
  border-bottom-right-radius: 9999px;
  border-top-right-radius: 9999px;
  margin-left: -1px;
}

.fc-button-group .fc-dayGridMonth-button {
  border-bottom-right-radius: 9999px !important;
  border-top-right-radius: 9999px !important;
}

.fc-button-group .fc-timeGridDay-button {
  border-bottom-left-radius: 9999px !important;
  border-top-left-radius: 9999px !important;
}

.fc-today-button {
  border-radius: 9999px !important;
}

.fc-timeGridWeek-button {
  margin: 0 10px !important;
}

.fc .fc-daygrid-day.fc-day-today {
  background-color: #eaf6ff;
}


@media screen and (max-width:600px) {
  .fc .fc-toolbar {
    display: block;
    text-align: center;
  }

  .fc-toolbar-chunk .fc-toolbar-title {
    margin: 15px 0
  }
}

/* 추가된 스타일 */
.event-details {
  padding: 10px;
}

.event-detail-item {
  margin-bottom: 10px;
}

.event-label {
  font-weight: bold;
}

.event-value {
  margin-left: 5px;
}

.edit-button {
  margin-top: 5px;
  display: block; /* 버튼을 블록 요소로 만들어 아래로 내림 */
}

.event-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.event-details-title {
  margin: 0;
}
</style>
