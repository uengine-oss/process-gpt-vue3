<script>
import { defineComponent } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

let eventGuid = 0
let todayStr = new Date().toISOString().replace(/T.*$/, '') // YYYY-MM-DD of today

const today = new Date();
const y = today.getFullYear();
const m = today.getMonth();
const d = today.getDate();

export const INITIAL_EVENTS = [

  {
    id: createEventId(),
    title: 'Twice event For two Days',
    allDay: true,
    start: new Date(y, m, 3),
    end: new Date(y, m, 5),
    color: '#615dff',
  },
  {
    id: createEventId(),
    title: 'Learn ReactJs',
    start: new Date(y, m, d + 3, 10, 30),
    end: new Date(y, m, d + 3, 11, 30),
    allDay: true,
    color: '#39b69a',
  },
  {
    id: createEventId(),
    title: 'Launching MaterialArt Angular',
    start: new Date(y, m, d + 7, 12, 0),
    end: new Date(y, m, d + 7, 14, 0),
    allDay: true,
    color: '#fc4b6c',
  },
  {
    id: createEventId(),
    title: 'Lunch with Mr.Raw',
    start: new Date(y, m, d - 2),
    end: new Date(y, m, d - 2),
    allDay: true,
    color: '#1a97f5',
  },
  {
    id: createEventId(),
    title: 'Going For Party of Sahs',
    start: new Date(y, m, d + 1, 19, 0),
    end: new Date(y, m, d + 1, 22, 30),
    allDay: true,
    color: '#1a97f5',
  },
  {
    id: createEventId(),
    title: 'Learn Ionic',
    start: new Date(y, m, 23),
    end: new Date(y, m, 25),
    color: '#fdd43f',
  },
  {
    id: createEventId(),
    title: 'Research of making own Browser',
    start: new Date(y, m, 19),
    end: new Date(y, m, 22),
    color: '615dff',
  },
]

export function createEventId() {
  return String(eventGuid++)
}



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
        initialEvents: INITIAL_EVENTS, // alternatively, use the `events` setting to fetch from a feed
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
    }
  },
  methods: {
    handleWeekendsToggle() {
      this.calendarOptions.weekends = !this.calendarOptions.weekends // update a property
    },
    handleDateSelect(selectInfo) {
      this.AddModal = true;
      const title ='Please enter a new title for your event'
      const calendarApi = selectInfo.view.calendar
      calendarApi.unselect() // clear date selection
      if (title) {
        calendarApi.addEvent({
          id: createEventId(),
          title,
          start: selectInfo.startStr,
          end: selectInfo.endStr,
          allDay: selectInfo.allDay
        })
      }
      
    },
    handleEventClick(clickInfo) {
      this.updateModalShow = true;
      // eventClick.clickInfo.event
    },
    handleEvents(events) {
      this.currentEvents = events;
    },
  }
})

</script>

<template>
  <div class='demo-app'>
    <div class='demo-app-main '>
      <FullCalendar class='demo-app-calendar rounded-md' :options='calendarOptions' >
        <template v-slot:eventContent='arg'>
          <div class="text-subtitle-1 pa-1 text-truncate">{{ arg.event.title }}</div>
        </template>
      </FullCalendar>
      <v-dialog v-model="updateModalShow" max-width="500px">
        <v-card>
          <v-card-text>
            <h4 class="text-h4">Update Event</h4>
            <p class="text-subtitle-1 text-grey100 my-4">To Edit/Update Event kindly change the title and choose the event
              color and press the update button</p>
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