import { el } from "./_util.js";

export default {
  tag: "puredashboard-pagination",
  title: "Navigation/Pagination",
  stories: [
    { name: "Basic", notes: "page 5 of 20 (200 items, 10 per page)", render: () =>
      el("puredashboard-pagination", { page: 5, total: 200, pageSize: 10 }) },
    { name: "Small", render: () =>
      el("puredashboard-pagination", { page: 2, pageCount: 3 }) },
    { name: "First page", render: () =>
      el("puredashboard-pagination", { page: 1, total: 200, pageSize: 10 }) },
    { name: "Last page", render: () =>
      el("puredashboard-pagination", { page: 20, total: 200, pageSize: 10 }) },
    { name: "Cursor paging (hasMore)", notes: "total unknown: 3 pages reached, one more offered, a trailing … while more may follow", render: () =>
      el("puredashboard-pagination", { page: 3, pageCount: 3, hasMore: true }) },
  ],
};
