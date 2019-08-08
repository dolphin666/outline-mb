"use strict";
/// <reference path="../../out/pxttypings/pxtelectron.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * A central place for the app shell to send and receive IPC messages
 */
function sendUpdateStatus(status) {
    sendIpcMessage("update-status" /* UpdateStatus */, status);
}
exports.sendUpdateStatus = sendUpdateStatus;
function sendUpdateInstalled() {
    sendIpcMessage("update-installed" /* UpdateInstalled */);
}
exports.sendUpdateInstalled = sendUpdateInstalled;
function sendCriticalUpdateFailed() {
    sendIpcMessage("update-critical-failed" /* CriticalUpdateFailed */);
}
exports.sendCriticalUpdateFailed = sendCriticalUpdateFailed;
function sendDriveDeployResult(isSuccess) {
    sendIpcMessage("drive-deploy-result" /* DriveDeployResult */, isSuccess);
}
exports.sendDriveDeployResult = sendDriveDeployResult;
/**
 * Don't use this; use Telemetry.tickEvent(). Only the Telemetry module should use this.
 */
function sendTelemetry(event) {
    sendIpcMessage("telemetry-event" /* Telemetry */, event);
}
exports.sendTelemetry = sendTelemetry;
function onUpdateStatusCheck(handler) {
    electron_1.ipcMain.on("check-update-status" /* CheckUpdateStatus */, () => {
        handler();
    });
}
exports.onUpdateStatusCheck = onUpdateStatusCheck;
function onTelemetryReady(handler) {
    electron_1.ipcMain.on("telemetry-ready" /* TelemetryReady */, () => handler());
}
exports.onTelemetryReady = onTelemetryReady;
function onQuit(handler) {
    electron_1.ipcMain.on("quit" /* Quit */, () => {
        handler();
    });
}
exports.onQuit = onQuit;
function onOpenDevTools(handler) {
    electron_1.ipcMain.on("open-dev-tools" /* OpenDevTools */, () => {
        handler();
    });
}
exports.onOpenDevTools = onOpenDevTools;
function onDriveDeploy(handler) {
    electron_1.ipcMain.on("drive-deploy" /* DriveDeploy */, (ipcEvent, res) => {
        handler(res);
    });
}
exports.onDriveDeploy = onDriveDeploy;
function sendIpcMessage(channel, ...args) {
    electron_1.BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(channel, ...args);
    });
}
//# sourceMappingURL=ipc.js.map