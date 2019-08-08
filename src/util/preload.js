"use strict";
/// <reference path="../../out/pxttypings/pxtelectron.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const isDev = require("electron-is-dev");
const productLoader_1 = require("./productLoader");
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * A central place for the hosted website to send and receive IPC messages
 */
/**
 * Registers a handler to invoke when the app shell requests a telemetry event to be sent to AI.
 * @param handler The handler to invoke
 */
function onTelemetry(handler) {
    electron_1.ipcRenderer.on("telemetry-event" /* Telemetry */, (ipcEvent, telemetryEvent) => {
        handler(telemetryEvent);
    });
    electron_1.ipcRenderer.send("telemetry-ready" /* TelemetryReady */);
}
/**
 * Registers a handler to invoke when the app shell notifies that an update was installed.
 * @param handler The handler to invoke
 */
function onUpdateInstalled(handler) {
    electron_1.ipcRenderer.on("update-installed" /* UpdateInstalled */, () => {
        handler();
    });
}
/**
 * Registers a handler to invoke when the app shell replies with the current update status.
 * @param handler The handler to invoke
 */
function onUpdateStatus(handler) {
    electron_1.ipcRenderer.on("update-status" /* UpdateStatus */, (ipcEvent, status) => {
        handler(status);
    });
}
/**
 * Registers a handler to invoke when the app shell notifies us that a critical update has failed.
 * @param handler The handler to invoke
 */
function onCriticalUpdateFailed(handler) {
    electron_1.ipcRenderer.on("update-critical-failed" /* CriticalUpdateFailed */, () => {
        handler();
    });
}
/**
 * Registers a handler to invoke when the app shell replies with the result of the last drive deploy attempt.
 * @param handler The handler to invoke
 */
function onDriveDeployResult(handler) {
    electron_1.ipcRenderer.on("drive-deploy-result" /* DriveDeployResult */, (ipcEvent, success) => {
        handler(success);
    });
}
/**
 * Asks the app shell about the current update status. The answer will come as a separate, asynchronous message.
 */
function sendUpdateStatusCheck() {
    electron_1.ipcRenderer.send("check-update-status" /* CheckUpdateStatus */);
}
/**
 * Asks the app shell to quit.
 */
function sendQuit() {
    electron_1.ipcRenderer.send("quit" /* Quit */);
}
/**
 * Asks the app shell to open dev tools.
 */
function sendOpenDevTools() {
    electron_1.ipcRenderer.send("open-dev-tools" /* OpenDevTools */);
}
/**
 * Asks the app to deploy the program to the device via USB file copy.
 */
function sendDriveDeploy(compileResult) {
    electron_1.ipcRenderer.send("drive-deploy" /* DriveDeploy */, compileResult);
}
// Versions for telemetry
const versionInfo = {
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    pxtElectronVersion: undefined,
    pxtCoreVersion: productLoader_1.default.target.versions.pxt,
    pxtTargetVersion: productLoader_1.default.target.versions.target,
    isProd: isDev ? 0 : 1
};
try {
    const packageJsonPath = path_1.resolve(__dirname, "..", "..", "..", "package.json");
    const packageJsonContent = JSON.parse(fs_1.readFileSync(packageJsonPath, "utf8"));
    versionInfo.pxtElectronVersion = packageJsonContent.pxtElectronVersion;
}
catch (e) {
    console.warn("Could not determine version of pxt-electron");
    versionInfo.pxtElectronVersion = "couldNotDetermine";
}
// The following object is injected in the hosted website
const pxtElectron = {
    onTelemetry,
    onUpdateInstalled,
    onUpdateStatus,
    onCriticalUpdateFailed,
    onDriveDeployResult,
    sendUpdateStatusCheck,
    sendQuit,
    sendOpenDevTools,
    sendDriveDeploy,
    versions: versionInfo
};
window.pxtElectron = pxtElectron;
//# sourceMappingURL=preload.js.map