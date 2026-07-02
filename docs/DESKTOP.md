# Desktop apps (Tauri / Wails)

PureDashboard is a plain-DOM UI layer, so it drops straight into a webview-based
desktop shell. This guide shows how to get a **native-feeling, frameless window**
with a custom `<puredashboard-titlebar>` and the optional **macOS skin**
(`theme/native.css`), on **Tauri** and **Wails**.

The pieces:

1. Make the OS window **frameless** (hide the default title bar).
2. Render `<puredashboard-titlebar>` as your window chrome.
3. Wire its window-control events to the runtime's window API.
4. Mark the drag region (differs per runtime).
5. (Optional) Turn on **native vibrancy** so the translucent title bar / sidebar
   blur the desktop behind the window.

```html
<html data-theme="dark" data-skin="macos">
  <link rel="stylesheet" href="/vendor/puredashboard/theme/tokens.css" />
  <link rel="stylesheet" href="/vendor/puredashboard/theme/native.css" />  <!-- the macOS skin -->
  <link rel="stylesheet" href="/vendor/puredashboard/components.css" />
  …
  <puredashboard-titlebar title="Acme Admin"></puredashboard-titlebar>
</html>
```

The titlebar emits three bubbling events — `minimize`, `maximizetoggle`, `close` —
and **never calls an OS API itself**; you wire them to the runtime below.

---

## Tauri (v2)

**1. Frameless window** — `src-tauri/tauri.conf.json`:

```jsonc
{
  "app": {
    "windows": [
      {
        "title": "Acme Admin",
        "width": 1100, "height": 720,
        "decorations": false,          // no OS title bar → we draw our own
        "transparent": true,           // needed for real vibrancy (see step 3)
        "titleBarStyle": "Overlay"     // macOS: keep the native traffic-lights on top
      }
    ],
    "macOSPrivateApi": true            // required for `transparent` on macOS
  }
}
```

- On **macOS**, `titleBarStyle: "Overlay"` keeps the real traffic-lights and lets
  your content sit under them — set `platform="mac"` on the titlebar so it reserves
  the left inset for them (default 78px, `--pd-titlebar-mac-inset`).
- On **Windows/Linux**, `decorations: false` removes all controls, so let the
  titlebar draw its own — `platform="windows"` (or leave `platform="auto"`).

**2. Wire the events:**

```js
import { getCurrentWindow } from "@tauri-apps/api/window";
const win = getCurrentWindow();
const bar = document.querySelector("puredashboard-titlebar");
bar.addEventListener("minimize",       () => win.minimize());
bar.addEventListener("maximizetoggle", () => win.toggleMaximize());
bar.addEventListener("close",          () => win.close());
// keep the maximize/restore icon in sync
win.onResized(async () => { bar.maximized = await win.isMaximized(); });
```

**3. Drag region** — Tauri reads a data attribute; add it to the bar:

```html
<puredashboard-titlebar title="Acme Admin" data-tauri-drag-region></puredashboard-titlebar>
```

The component already sets `-webkit-app-region: drag` (Electron/Wails) and marks
its buttons no-drag; `data-tauri-drag-region` covers Tauri. (Tauri ignores clicks
that land on `no-drag`/interactive children.)

**4. Native vibrancy** (optional, macOS) — add a window effect so the desktop
blurs behind the translucent title bar/sidebar:

```jsonc
// tauri.conf.json → app.windows[0]
"windowEffects": { "effects": ["sidebar"], "radius": 10 }
```

or, cross-platform, the [`window-vibrancy`](https://crates.io/crates/window-vibrancy)
crate in `lib.rs` (`apply_vibrancy` on macOS, `apply_acrylic`/`apply_mica` on
Windows). Without this the CSS `backdrop-filter` still frosts in-app content.

---

## Wails (v2)

**1. Frameless window** — `main.go`:

```go
err := wails.Run(&options.App{
    Title:  "Acme Admin",
    Width:  1100, Height: 720,
    Frameless: true,                       // no OS title bar
    Mac: &mac.Options{
        TitleBar:                mac.TitleBarHiddenInset(), // keep traffic-lights, inset
        WebviewIsTransparent:    true,
        WindowIsTranslucent:     true,      // real vibrancy behind the window
    },
    Windows: &windows.Options{ WebviewIsTransparent: true, WindowIsTranslucent: true },
})
```

**2. Wire the events** (Wails exposes a JS runtime):

```js
import { WindowMinimise, WindowToggleMaximise, Quit } from "../wailsjs/runtime/runtime";
const bar = document.querySelector("puredashboard-titlebar");
bar.addEventListener("minimize",       () => WindowMinimise());
bar.addEventListener("maximizetoggle", () => WindowToggleMaximise());
bar.addEventListener("close",          () => Quit());
```

**3. Drag region** — Wails uses a CSS style, which the component sets for you on the
bar (`--wails-draggable: drag`) and clears on its interactive children
(`--wails-draggable: no-drag`). Nothing extra to add. (If you build a custom
draggable area yourself, put `style="--wails-draggable:drag"` on it.)

- On **macOS**, `TitleBarHiddenInset()` keeps the traffic-lights → use
  `platform="mac"`. On **Windows/Linux**, `Frameless: true` removes controls → the
  titlebar draws its own (`platform="windows"` / `auto`).

---

## Platform detection

`<puredashboard-titlebar platform="auto">` (the default) sniffs
`navigator.userAgentData?.platform` (falling back to `navigator.platform`) and:

- **mac** → centres the title, reserves the traffic-light inset, hides custom
  controls (the OS shows them). Force custom controls with the `controls` attribute.
- **windows / linux** → left-aligns the title and renders minimize / maximize /
  close buttons on the right.

Set `platform` explicitly if you prefer a fixed look across OSes.

---

## Notes

- **Everything stays zero-dependency / no-build / CSP-safe** — the titlebar and skin
  are plain CSS + DOM. Only the *window* wiring uses the runtime's own JS API.
- The macOS skin is opt-in via `data-skin="macos"`; drop it to fall back to the
  standard PureDashboard look on any platform.
- Real desktop-behind vibrancy requires the native transparency flags above; CSS
  `backdrop-filter` alone frosts only content inside the app.
