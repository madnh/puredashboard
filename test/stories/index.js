// PureBook story registry (dev-only). Import each component's stories and list
// them here — no build step, so imports are explicit. Keep alphabetical-ish by
// family; the gallery groups by the `title` prefix.
import button from "./button.stories.js";
import input from "./input.stories.js";
import timeline from "./timeline.stories.js";
import alert from "./alert.stories.js";

export const STORIES = [
  button,
  input,
  timeline,
  alert,
];
