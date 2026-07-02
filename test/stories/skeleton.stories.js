import { el, vstack } from "./_util.js";

const sk = (props) => el("puredashboard-skeleton", props);

export default {
  tag: "puredashboard-skeleton",
  title: "Feedback/Skeleton",
  stories: [
    { name: "Text", render: () => sk({ variant: "text", lines: 3 }) },
    { name: "Rect", render: () => sk({ variant: "rect", width: "240px", height: "120px" }) },
    { name: "Circle", render: () => sk({ variant: "circle", width: "64px" }) },
    { name: "Static (no animation)", render: () => vstack([
      sk({ variant: "text", lines: 2, animated: false }),
      sk({ variant: "rect", width: "200px", height: "80px", animated: false }),
    ]) },
  ],
};
