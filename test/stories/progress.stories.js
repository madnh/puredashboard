import { el, vstack } from "./_util.js";

const p = (props) => el("puredashboard-progress", props);

export default {
  tag: "puredashboard-progress",
  title: "Feedback/Progress",
  stories: [
    { name: "Line", render: () => vstack([
      p({ value: 30 }),
      p({ value: 70 }),
      p({ value: 100 }),
    ]) },
    { name: "Success", render: () => p({ value: 100, status: "success" }) },
    { name: "Error", render: () => p({ value: 60, status: "error" }) },
    { name: "Indeterminate", render: () => p({ indeterminate: true }) },
    { name: "Circle", render: () => vstack([
      p({ variant: "circle", value: 68 }),
      p({ variant: "circle", value: 100, status: "success" }),
    ]) },
    { name: "Inline", notes: "inline attribute: a thin bar on the same line as text", render: () => {
      const bar = p({ value: 64, size: "sm", showInfo: false });
      bar.setAttribute("inline", "");
      bar.style.width = "120px";
      return el("p", { style: "margin:0" }, [document.createTextNode("Quota used "), bar, document.createTextNode(" 64%")]);
    } },
  ],
};
