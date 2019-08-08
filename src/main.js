"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const deploy = require("./deploy");
const ipc = require("./util/ipc");
const path = require("path");
const process = require("process");
const Promise = require("bluebird");
const squirrel = require("./updater/squirrelWindows");
const staticServer_1 = require("./staticServer");
const Telemetry = require("./util/telemetry");
const updateService = require("./updater/updateService");
const URL = require("url");
let win;
process.on("uncaughtException", (e) => {
    Telemetry.tickEvent("uncaughtexception");
    electron_1.dialog.showErrorBox("Unexpected Error", `An unexpected error has occurred. If this persists, please report it at https://github.com/Microsoft/pxt/issues/new.\n\n${e}\n\n${e.stack}`);
    electron_1.app.quit();
});
function main() {
    Promise.resolve()
        .then(() => {
        return squirrel.initAsync(); // Squirrel events must be handled as early as possible in the startup process
    })
        .then(() => {
        Telemetry.init();
        updateService.init();
        deploy.initDriveDeploy();
        return staticServer_1.StaticServer.instance.start();
    })
        .then(() => {
        createWindow();
    });
}
function createWindow() {
    win = new electron_1.BrowserWindow({
        webPreferences: {
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "util", "preload.js")
        },
        show: false
    });
    win.maximize();
    win.show();
    win.on("closed", () => {
        win = null;
    });
    function openInBrowser(event, navigatingToUrl) {
        const currentUrl = URL.parse(win.webContents.getURL());
        const newUrl = URL.parse(navigatingToUrl);
        if (newUrl.host !== currentUrl.host || newUrl.pathname !== currentUrl.pathname) {
            console.log("Opening external URL: " + navigatingToUrl);
            event.preventDefault();
            electron_1.shell.openExternal(navigatingToUrl);
        }
    }
    win.webContents.addListener('will-navigate', openInBrowser);
    win.webContents.addListener('new-window', openInBrowser);
    electron_1.Menu.setApplicationMenu(null);
    win.loadURL(`${staticServer_1.StaticServer.instance.url}/index.html?local_token=${staticServer_1.StaticServer.instance.localToken}#local_token=${staticServer_1.StaticServer.instance.localToken}`);
    if (electron_1.session.defaultSession) {
        electron_1.session.defaultSession.setPermissionRequestHandler((webContents, permission, cb) => {
            console.log("A chromium permission was denied:");
            console.log(`    URL: ${webContents.getURL()}`);
            console.log(`    Permission: ${permission}`);
            cb(false);
        });
    }
    function openDevTools() {
        if (win && win.webContents) {
            win.webContents.openDevTools({ mode: "detach" });
        }
    }
    win.webContents.on("did-finish-load", () => {
        if (process.argv.some((arg) => arg === "--debug-webview")) {
            openDevTools();
        }
    });
    ipc.onOpenDevTools(() => openDevTools());
    // Electron does not support context menus by default
    // See https://github.com/electron/electron/issues/4068#issuecomment-274159726
    const selectionMenu = electron_1.Menu.buildFromTemplate([
        { role: "copy" },
        { type: "separator" },
        { role: "selectall" }
    ]);
    const inputMenu = electron_1.Menu.buildFromTemplate([
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        { role: "selectall" }
    ]);
    win.webContents.on("context-menu", (e, props) => {
        if (props.isEditable) {
            inputMenu.popup({ window: win });
        }
        else if (props.selectionText && props.selectionText.trim()) {
            selectionMenu.popup({ window: win });
        }
    });
}
function dispose() {
    staticServer_1.StaticServer.instance.dispose();
}
electron_1.app.on("ready", () => {
    main();
});
electron_1.app.on('will-quit', () => {
    dispose();
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (win === null) {
        createWindow();
    }
    else {
        win.restore();
        win.focus();
    }
});
// Enforce single instance of the app
const isMultipleInstance = !electron_1.app.requestSingleInstanceLock();
electron_1.app.on('second-instance', () => {
    if (win) {
        win.restore();
        win.focus();
    }
});
if (isMultipleInstance) {
    electron_1.app.quit();
}
//# sourceMappingURL=main.js.map