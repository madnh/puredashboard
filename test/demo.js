// Demo app wiring every vendor module together: reactive components as a router
// layout + pages, an auth guard that redirects to login, and confirm()/toast().
import { Reactive, html, repeat } from "../src/reactive.js";
import { Router } from "../src/router.js";
import { confirm } from "../src/dialog.js";
import { toast } from "../src/toast.js";

const auth = { ok: false };
let nodes = [
  { id: "web", msgs: 12 },
  { id: "api", msgs: 7 },
  { id: "db", msgs: 3 },
];

// ---- Login page (no layout) ------------------------------------------------
class LoginPage extends Reactive {
  setup() {
    this.on("click", "#login-btn", () => {
      auth.ok = true;
      this.ctx.router.navigate("/");
    });
  }
  render() {
    return html`<div class="login-card">
      <h2>Sign in</h2>
      <p>Demo — click to authenticate.</p>
      <button
        id="login-btn"
        class="puredashboard-dialog__button puredashboard-dialog__button--primary"
      >
        Log in
      </button>
    </div>`;
  }
}
LoginPage.define("demo-login");

// ---- Dashboard layout (Reactive chrome + stable outlet) --------------------
class DashLayout extends Reactive {
  static properties = { online: {} };
  constructor() {
    super();
    this.outlet = document.createElement("main");
    this.outlet.className = "dash-main";
    this.online = 0;
  }
  connectedCallback() {
    super.connectedCallback();
    this._t = setInterval(() => {
      this.online = this.online + 1;
    }, 1200);
  }
  disconnectedCallback() {
    clearInterval(this._t);
  }
  setup() {
    this.on("click", "#logout", () => {
      auth.ok = false;
      this.ctx.router.navigate("/login");
    });
  }
  render() {
    return html`<aside class="sidebar">
        <div class="brand">Plexus</div>
        <nav><a href="#/">Overview</a><a href="#/nodes">Nodes</a></nav>
        <div class="badge" id="online">${this.online} live ticks</div>
        <button id="logout" class="puredashboard-dialog__button">
          Log out
        </button>
      </aside>
      ${this.outlet}`;
  }
}
DashLayout.define("demo-dash");

// ---- Pages -----------------------------------------------------------------
class HomePage extends Reactive {
  render() {
    return html`<h2>Overview</h2>
      <p>Welcome. The sidebar badge ticks live without wiping this page.</p>
      <div class="card">
        Nodes registered: <b id="home-count">${nodes.length}</b>
      </div>`;
  }
}
HomePage.define("demo-home");

class NodesPage extends Reactive {
  static properties = { list: {} };
  connectedCallback() {
    super.connectedCallback();
    this.list = nodes.slice();
  }
  setup() {
    this.on("click", ".del", async (e, el) => {
      const id = el.dataset.id;
      if (
        await confirm(`Delete node "${id}"?`, {
          title: "Confirm delete",
          danger: true,
        })
      ) {
        nodes = nodes.filter((n) => n.id !== id);
        this.list = nodes.slice();
        toast.success(`Deleted "${id}"`);
      }
    });
  }
  render() {
    return html`<h2>Nodes</h2>
      <ul class="node-list" id="node-list">
        ${repeat(
          this.list || [],
          (n) => n.id,
          (n) =>
            html` <li data-row="${n.id}">
              <span class="nid">${n.id}</span
              ><span class="nmsg">${n.msgs} msgs</span>
              <button
                class="del puredashboard-dialog__button"
                data-id="${n.id}"
              >
                Delete
              </button>
            </li>`,
        )}
      </ul>`;
  }
}
NodesPage.define("demo-nodes");

// ---- Router: lazy pages, dashboard layout, auth guard ----------------------
const router = new Router({
  outlet: "#app",
  mode: "hash",
  appName: "PlexusDemo",
  layouts: { dashboard: () => Promise.resolve({ default: "demo-dash" }) },
  routes: {
    "/login": {
      title: "Login",
      load: () => Promise.resolve({ default: "demo-login" }),
    },
    "/": {
      title: "Overview",
      layout: "dashboard",
      meta: { auth: true },
      load: () => Promise.resolve({ default: "demo-home" }),
    },
    "/nodes": {
      title: "Nodes",
      layout: "dashboard",
      meta: { auth: true },
      load: () => Promise.resolve({ default: "demo-nodes" }),
    },
    "*": {
      title: "Not found",
      load: () =>
        Promise.resolve({
          default: (o) => {
            o.innerHTML = '<h2>404</h2><a href="#/">Home</a>';
          },
        }),
    },
  },
  beforeEach: (to) => {
    if (to.route.meta && to.route.meta.auth && !auth.ok) return "/login";
    if (to.path === "/login" && auth.ok) return "/";
  },
});

// test hooks for the Playwright driver
window.__app = {
  router,
  get nodes() {
    return nodes;
  },
  get authed() {
    return auth.ok;
  },
};
router.start();
