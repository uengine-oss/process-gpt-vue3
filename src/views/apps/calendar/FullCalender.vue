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
      AddModal: false,
      calendarOptions: {
        plugins: [
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin // needed for dateClick
        ],
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        initialView: 'dayGridMonth',
        initialEvents: [], // alternatively, use the `events` setting to fetch from a feed
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,
        select: this.handleDateSelect,
        eventClick: this.handleEventClick,
        eventsSet: this.handleEvents,
        // eventAdd:this.handleDateSelect
        /* you can update a remote database when these fire:
        eventAdd:
        eventChange:
        eventRemove:
        */
      },
      currentEvents: [],
      render: 0,
      selectedEvent: {}, // Initialize event data for editing
    }
  },
  async created() {
    this.storage = StorageBase.getStorage("supabase");
    let option = {
        key: "uid"
    }
    const res = await this.storage.getObject(`db://calendar/${localStorage.getItem('uid')}`, option);
    // console.log(data)
    if(res){
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const calendarKey = `${currentYear}_${currentMonth < 10 ? `0${currentMonth}` : currentMonth}`;
      if (res && res.data && res.data[calendarKey]) {
        this.calendarOptions.initialEvents = Object.values(res.data[calendarKey]);
      }
      // this.calendarOptions.initialEvents = Object.values(data);
      // console.log(this.calendarOptions)
      this.render++;
    }
  },
  methods: {
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
      this.calendarOptions.weekends = !this.calendarOptions.weekends // update a property
    },
    handleDateSelect(selectInfo) {
      // this.AddModal = true;
      const title ='Please enter a new title for your event'
      const calendarApi = selectInfo.view.calendar
      calendarApi.unselect() // clear date selection
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
      this.updateModalShow = true;
      // this.render++;
    },
    handleEvents(events) {
      this.currentEvents = events;
    },
    async saveCalendar(option) {
      var me = this
      const date = new Date(this.selectedEvent.start);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-based.

      let calendarData = {}
      calendarData[`${year}_${month}`] = {}

      this.calendarOptions.initialEvents.forEach(data => {
        calendarData[`${year}_${month}`][data.id] = data;
      });

      let calendarObj = {
          "uid": localStorage.getItem('uid'),
          "data": calendarData
      }
      await this.storage.putObject(`db://calendar/${localStorage.getItem('uid')}`, calendarObj);
    },
    updateEvent() {
      let eventIdx = this.calendarOptions.initialEvents.findIndex(x => x.id == this.selectedEvent.id)
      this.calendarOptions.initialEvents[eventIdx] = this.selectedEvent
      this.updateModalShow = false;
      this.saveCalendar()
      // this.render++;
    },
    deleteEvent() {
      let eventIdx = this.calendarOptions.initialEvents.findIndex(x => x.id == this.selectedEvent.id);
      if (eventIdx !== -1) {
        this.calendarOptions.initialEvents.splice(eventIdx, 1);
      }
      this.updateModalShow = false;
      this.saveCalendar()
      // this.render++;
    },
  }
})

</script>

<template>
  <div class='demo-app'>
    <div :key="render" class='demo-app-main '>
      <FullCalendar class='demo-app-calendar rounded-md' :options='calendarOptions' >
        <template v-slot:eventContent='arg'>
          <div class="text-subtitle-1 pa-1 text-truncate">{{ arg.event.title }}</div>
        </template>
      </FullCalendar>
      <v-dialog v-model="updateModalShow" max-width="500px">
        <v-card>
          <v-card-text>
            <h4 class="text-h4">Update Event</h4>
            <p class="text-subtitle-1 text-grey100 my-4">To Edit/Update Event kindly change the title and choose the event color and press the update button</p>
            <!-- Add input fields for event data -->
            <v-text-field
              v-model="selectedEvent.title"
              label="Event Title"
              outlined
            ></v-text-field>
            <v-text-field
              v-model="selectedEvent.start"
              label="Start Date"
              outlined
            ></v-text-field>
            <v-text-field
              v-model="selectedEvent.end"
              label="End Date"
              outlined
            ></v-text-field>
              <!-- <v-text-field
                v-model="selectedEvent.allDay"
                label="All Day"
                type="checkbox"
              ></v-text-field> -->
            <v-text-field
              v-model="selectedEvent.color"
              label="Color"
              outlined
            ></v-text-field>
            <!-- Update button to trigger event update -->
            <v-btn style="margin-right: 5px;" color="primary" @click="updateEvent">Update</v-btn>
            <v-btn color="error" @click="deleteEvent">Delete</v-btn>
          </v-card-text>
        </v-card>
      </v-dialog>

      <v-dialog v-model="AddModal" max-width="500px">
        <v-card>
          <v-card-text>
            <h4 class="text-h4">Add Event</h4>
            <p class="text-subtitle-1 text-grey100 my-4">To add Event kindly fillup the title and choose the event color
              and press the add button</p>

              <!-- <div v-for='event in currentEvents' :key='event.id'>
                <v-text-field
            :model-value=event.title
            label="Outlined"
            variant="outlined"
          ></v-text-field>
              </div> -->
              
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
}</style>