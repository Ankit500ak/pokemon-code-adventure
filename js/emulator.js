// EmulatorJS integration — BYO-ROM only.
// The learner's .gba file is turned into a local object URL in this tab.
// It is never uploaded anywhere; this project ships with no ROM.

const DATA_CDN = "https://cdn.emulatorjs.org/stable/data/";
let loaderInjected = false;

export function romInfo(file) {
  return {
    name: file.name,
    sizeMB: (file.size / (1024 * 1024)).toFixed(2),
    isGba: /\.gba$/i.test(file.name),
  };
}

/**
 * Load a user-selected ROM into the #emuGame element via EmulatorJS.
 * onStatus(statusString) reports progress/failure. Returns true if the
 * loader script was injected; EmulatorJS itself reports load errors via
 * its own UI, and a watchdog reports if nothing appears.
 */
export function loadRomIntoEmulator(file, { onStatus } = {}) {
  const info = romInfo(file);
  if (!info.isGba) {
    onStatus?.(`Rejected: "${file.name}" is not a .gba file.`);
    return false;
  }
  const url = URL.createObjectURL(file);
  window.EJS_player = "#emuGame";
  window.EJS_core = "gba";
  window.EJS_gameUrl = url;
  window.EJS_gameName = file.name;
  window.EJS_pathtodata = DATA_CDN;
  window.EJS_startOnLoaded = false;
  window.EJS_DEBUG_XX = false;

  if (loaderInjected) {
    onStatus?.("EmulatorJS is already running — reload the page to load a different ROM.");
    return false;
  }
  loaderInjected = true;
  const script = document.createElement("script");
  script.src = DATA_CDN + "loader.js";
  script.async = true;
  script.onerror = () => {
    onStatus?.("Could not load EmulatorJS from its CDN (offline?). Practice World and Block Studio still work fully.");
  };
  document.body.appendChild(script);
  onStatus?.(`ROM loaded locally: ${info.name} (${info.sizeMB} MB). Press Play in the emulator when ready.`);
  setTimeout(() => {
    const hasCanvas = document.querySelector("#emuGame canvas, #emuGame iframe");
    if (!hasCanvas) onStatus?.("Emulator is taking a while — if it never appears, check your connection (the core loads from the EmulatorJS CDN) or use Practice World.");
  }, 9000);
  return true;
}

export function emulatorCanvas() {
  return document.querySelector("#emuGame canvas");
}
