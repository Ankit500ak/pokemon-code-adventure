// Pokémon Code Adventure — Electron main process.
//
// The desktop app is the SAME web app, not a fork: this process starts
// the project's zero-dependency static server (server.mjs) on 127.0.0.1
// and loads it in a BrowserWindow.
//
// Why an embedded http server instead of file:// ?
//  - index.html loads native ES modules (blocked by CORS under file://)
//  - the capstone loader fetch()es examples/capstone-workflow.json
//    (fetch of local files is not allowed under file://)
//  - localStorage behaves consistently on an http://127.0.0.1 origin
// Serving over loopback http makes the desktop behaviour identical to
// `npm start`, which is exactly what the play-tests verify.
//
// Port: ephemeral by default (port 0). Set PCA_PORT to pin one (used by
// the automated smoke test). The chosen URL is printed to stdout as
// PCA_DESKTOP_URL=<url> so tests can find it.

const { app, BrowserWindow, shell } = require("electron");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

let server = null;

async function startServer() {
  const serverModuleUrl = pathToFileURL(join(__dirname, "..", "server.mjs")).href;
  const { startStaticServer } = await import(serverModuleUrl);
  const pinned = Number(process.env.PCA_PORT ?? 0);
  return startStaticServer({ port: Number.isFinite(pinned) ? pinned : 0 });
}

async function createWindow() {
  const started = await startServer();
  server = started.server;
  console.log(`PCA_DESKTOP_URL=${started.url}`);

  const win = new BrowserWindow({
    width: 1460,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    title: "Pokémon Code Adventure — Block Studio",
    icon: join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Any attempt to open a new window (e.g. a target=_blank link) goes to
  // the system browser instead of a second app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  await win.loadURL(started.url);
}

app.whenReady().then(createWindow).catch((err) => {
  console.error("Failed to start Pokémon Code Adventure:", err);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (server) server.close();
});
