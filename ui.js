import { els, templates } from './ui/elements.js';
import { getResizedUrl, initDragScroll } from './ui/helpers.js';
import { toast, alert, confirm } from './ui/notifications.js';
import { toggleAuthView, toggleTheme, setTheme, applyTheme, openThemePicker, enableReadOnlyMode } from './ui/views.js';
import { updatePreviewPoster, toggleDataAssistido, renderGenerosTags, renderCustomTags, clearForm, fillForm } from './ui/form.js';
import { renderSkeletons, renderContent, renderTable, renderGrid, renderVitrines } from './ui/lists.js';
import { updateStats, renderRankings, renderCharts, renderCarousel, chartsInstances } from './ui/stats.js';
import { renderProfile, renderAchievements } from './ui/profile.js';
import { showMovieDetailModal, showRandomSuggestion } from './ui/modals.js';

export const UI = {
    els,
    templates,
    chartsInstances,
    toast, alert, confirm,
    toggleAuthView, toggleTheme, setTheme, applyTheme, openThemePicker, enableReadOnlyMode,
    updatePreviewPoster, toggleDataAssistido, renderGenerosTags, renderCustomTags, clearForm, fillForm,
    renderSkeletons, renderContent, renderTable, renderGrid, renderVitrines,
    updateStats, renderRankings, renderCharts, renderCarousel,
    renderProfile, renderAchievements,
    showMovieDetailModal, showRandomSuggestion,
    initDragScroll
};