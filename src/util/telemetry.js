"use strict";
/// <reference path="../../out/pxttypings/pxtelectron.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const ipc = require("./ipc");
let isTelemetryReady = false;
let unreportedEvents = [];
/**
 * Sends a PXT-Electron shell telemetry event to the editor for collection by Application Insights.
 * @param eventName The name of the event (it will be prefixed with "pxtelectron.shell.")
 * @param data Optional data to send
 */
function tickEvent(eventName, data) {
    const telemetryReport = {
        event: `pxtelectron.shell.${eventName}`,
        data
    };
    if (isTelemetryReady) {
        ipc.sendTelemetry(telemetryReport);
    }
    else {
        unreportedEvents.push(telemetryReport);
    }
}
exports.tickEvent = tickEvent;
function init() {
    ipc.onTelemetryReady(() => {
        isTelemetryReady = true;
        unreportedEvents.forEach((ev) => {
            ipc.sendTelemetry(ev);
        });
        unreportedEvents = [];
    });
}
exports.init = init;
//# sourceMappingURL=telemetry.js.map