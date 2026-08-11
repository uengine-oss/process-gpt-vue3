import type { App } from 'vue';

import './styles/index.css';

import PgAlert from './components/PgAlert.vue';
import PgAppShell from './components/PgAppShell.vue';
import PgAvatar from './components/PgAvatar.vue';
import PgButton from './components/PgButton.vue';
import PgCard from './components/PgCard.vue';
import PgCheckbox from './components/PgCheckbox.vue';
import PgChip from './components/PgChip.vue';
import PgCodeBlock from './components/PgCodeBlock.vue';
import PgComposer from './components/PgComposer.vue';
import PgDialog from './components/PgDialog.vue';
import PgDivider from './components/PgDivider.vue';
import PgField from './components/PgField.vue';
import PgIcon from './components/PgIcon.vue';
import PgListItem from './components/PgListItem.vue';
import PgMenu from './components/PgMenu.vue';
import PgMenuItem from './components/PgMenuItem.vue';
import PgMessage from './components/PgMessage.vue';
import PgProgress from './components/PgProgress.vue';
import PgRadioGroup from './components/PgRadioGroup.vue';
import PgSelect from './components/PgSelect.vue';
import PgSkeleton from './components/PgSkeleton.vue';
import PgSpinner from './components/PgSpinner.vue';
import PgSwitch from './components/PgSwitch.vue';
import PgTable from './components/PgTable.vue';
import PgTabs from './components/PgTabs.vue';
import PgTextField from './components/PgTextField.vue';
import PgTextarea from './components/PgTextarea.vue';
import PgThread from './components/PgThread.vue';
import PgToolStep from './components/PgToolStep.vue';
import PgToolSteps from './components/PgToolSteps.vue';
import PgTooltip from './components/PgTooltip.vue';

export const components = {
    PgAlert,
    PgAppShell,
    PgAvatar,
    PgButton,
    PgCard,
    PgCheckbox,
    PgChip,
    PgCodeBlock,
    PgComposer,
    PgDialog,
    PgDivider,
    PgField,
    PgIcon,
    PgListItem,
    PgMenu,
    PgMenuItem,
    PgMessage,
    PgProgress,
    PgRadioGroup,
    PgSelect,
    PgSkeleton,
    PgSpinner,
    PgSwitch,
    PgTable,
    PgTabs,
    PgTextField,
    PgTextarea,
    PgThread,
    PgToolStep,
    PgToolSteps,
    PgTooltip
};

/**
 * 디자인 시스템 전역 등록.
 *
 * Vuetify 와 달리 런타임 테마 객체가 없다. 색·타이포·형태는 전부 CSS custom property
 * (`src/ds/styles/tokens.css`) 라서, 테마 전환은 `<html data-mode="light|dark">` 하나로 끝난다.
 */
export default {
    install(app: App) {
        Object.entries(components).forEach(([name, component]) => {
            app.component(name, component);
        });
    }
};

export { setMode, getMode, toggleMode, initMode } from './mode';
export type Mode = 'light' | 'dark';
