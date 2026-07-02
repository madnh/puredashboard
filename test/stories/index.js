// PureBook story registry (dev-only). Explicit imports (no build/glob). The
// gallery groups entries by the `title` prefix, so array order = display order.
// General
import button from "./button.stories.js";
import segmented from "./segmented.stories.js";
// Layout
import divider from "./divider.stories.js";
import space from "./space.stories.js";
import flex from "./flex.stories.js";
import grid from "./grid.stories.js";
import layout from "./layout.stories.js";
import splitter from "./splitter.stories.js";
import titlebar from "./titlebar.stories.js";
// Form
import input from "./input.stories.js";
import textarea from "./textarea.stories.js";
import number from "./number.stories.js";
import select from "./select.stories.js";
import combobox from "./combobox.stories.js";
import checkbox from "./checkbox.stories.js";
import switchStory from "./switch.stories.js";
import radioGroup from "./radio-group.stories.js";
import slider from "./slider.stories.js";
import date from "./date.stories.js";
import time from "./time.stories.js";
import color from "./color.stories.js";
import rate from "./rate.stories.js";
import form from "./form.stories.js";
// Navigation
import tabs from "./tabs.stories.js";
import breadcrumb from "./breadcrumb.stories.js";
import pagination from "./pagination.stories.js";
import steps from "./steps.stories.js";
import nav from "./nav.stories.js";
// Data display
import table from "./table.stories.js";
import card from "./card.stories.js";
import descriptions from "./descriptions.stories.js";
import statistic from "./statistic.stories.js";
import tag from "./tag.stories.js";
import badge from "./badge.stories.js";
import avatar from "./avatar.stories.js";
import list from "./list.stories.js";
import tree from "./tree.stories.js";
import collapse from "./collapse.stories.js";
import timeline from "./timeline.stories.js";
import empty from "./empty.stories.js";
import md from "./md.stories.js";
import upload from "./upload.stories.js";
// Overlay
import tooltip from "./tooltip.stories.js";
import popover from "./popover.stories.js";
import popconfirm from "./popconfirm.stories.js";
// Feedback
import alert from "./alert.stories.js";
import progress from "./progress.stories.js";
import spinner from "./spinner.stories.js";
import skeleton from "./skeleton.stories.js";
import result from "./result.stories.js";

export const STORIES = [
  button, segmented,
  divider, space, flex, grid, layout, splitter, titlebar,
  input, textarea, number, select, combobox, checkbox, switchStory, radioGroup, slider, date, time, color, rate, form,
  tabs, breadcrumb, pagination, steps, nav,
  table, card, descriptions, statistic, tag, badge, avatar, list, tree, collapse, timeline, empty, md, upload,
  tooltip, popover, popconfirm,
  alert, progress, spinner, skeleton, result,
];
