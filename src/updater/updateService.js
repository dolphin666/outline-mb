"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isDev = require("electron-is-dev");
const ipc = require("../util/ipc");
const electron = require("electron");
const manifestDownload = require("../util/manifest");
const productloader_1 = require("../util/productloader");
const Promise = require("bluebird");
const semver = require("semver");
const Telemetry = require("../util/telemetry");
let updateStatusDeferred = Promise.defer();
function init() {
    ipc.onUpdateStatusCheck(() => {
        updateStatusDeferred.promise
            .then((status) => {
            if (status === "banned-without-update" /* BannedWithoutUpdate */ || status === "updating-critical" /* UpdatingCritical */) {
                ipc.onQuit(() => {
                    electron.app.quit();
                });
            }
            ipc.sendUpdateStatus(status);
        });
    });
    if (!isUpdateEnabled()) {
        Telemetry.tickEvent("update.notenabled");
        return updateStatusDeferred.resolve("ok" /* Ok */);
    }
    // Start update sequence asynchronously; the editor will wait for the banned version check
    manifestDownload.getElectronManifestAsync()
        .then((manifest) => {
        if (!manifest) {
            // No manifest; be permissive on banned version check
            Telemetry.tickEvent("update.error.nomanifest");
            return updateStatusDeferred.resolve("ok" /* Ok */);
        }
        const currentVersion = productloader_1.default.target.versions.target;
        const latestVersion = semver.parse(manifest.latest);
        let isLatestBanned = false;
        let isCurrentBanned = false;
        if (manifest.banned) {
            manifest.banned.forEach((v) => {
                if (semver.eq(currentVersion, v)) {
                    isCurrentBanned = true;
                }
                if (latestVersion && semver.eq(latestVersion, v)) {
                    isLatestBanned = true;
                }
            });
        }
        if (!latestVersion || isLatestBanned || semver.gte(currentVersion, latestVersion)) {
            let telemetryEvent;
            if (!latestVersion) {
                telemetryEvent = "update.error.unknownlatest";
            }
            else if (isLatestBanned) {
                telemetryEvent = "update.error.bannedlatest";
            }
            else {
                telemetryEvent = "update.uptodate";
            }
            Telemetry.tickEvent(telemetryEvent, {
                latest: manifest.latest,
                current: currentVersion,
                isCurrentBanned: isCurrentBanned ? "true" : "false"
            });
            if (isCurrentBanned) {
                // Current version is banned but we don't have an update; editor will notify user and quit
                return updateStatusDeferred.resolve("banned-without-update" /* BannedWithoutUpdate */);
            }
            else {
                // No update available and current version isn't banned, so continue normally
                return updateStatusDeferred.resolve("ok" /* Ok */);
            }
        }
        Telemetry.tickEvent("update.available", {
            current: productloader_1.default.target.versions.target,
            latest: manifest.latest,
            isCurrentBanned: isCurrentBanned ? "true" : "false"
        });
        if (isCurrentBanned) {
            // User will have to wait while we install the critical update
            updateStatusDeferred.resolve("updating-critical" /* UpdatingCritical */);
        }
        else {
            // Update will happen in the background while the user continues using the app
            updateStatusDeferred.resolve("ok" /* Ok */);
        }
        function autoupdaterError(errorEvent) {
            updateStatusDeferred.promise.then((status) => {
                Telemetry.tickEvent(errorEvent, { status });
                if (status === "updating-critical" /* UpdatingCritical */) {
                    ipc.sendCriticalUpdateFailed();
                }
            });
        }
        try {
            const updateUrl = getUpdateUrl(latestVersion.raw);
            electron.autoUpdater.setFeedURL({ url: updateUrl });
        }
        catch (e) {
            // This can happen on Mac if the app is not signed;
            return autoupdaterError("update.error.setfeedurlfailed");
        }
        electron.autoUpdater.once("error" /* Error */, (e) => {
            autoupdaterError("update.error.updatererror");
        });
        electron.autoUpdater.once("update-not-available" /* UpdateNotAvailable */, () => {
            // Unexpected; we've already determined there was an update. We should check that the following are
            // consistent:
            //   - RELEASES file, which is under "releases" in the GitHub built repo, at the desired update tag
            //   - Electron manifest entries in targetconfig.json
            //   - Release assets (.zip for OSX, *.nupkg for Windows), under "releases" in the GitHub built
            //     repo, at the desired update tag
            autoupdaterError("update.error.notavailable");
        });
        electron.autoUpdater.once("update-downloaded" /* UpdateDownloaded */, () => {
            Telemetry.tickEvent("update.downloaded");
            if (isCurrentBanned) {
                // The editor was waiting on this app to be installed; restart the app
                electron.autoUpdater.quitAndInstall();
            }
            else {
                // Simply notify the user; the app will already be updated the next time the app launches
                ipc.sendUpdateInstalled();
            }
        });
        // This call initiates the update installation; delay a few seconds to improve app startup perf
        setTimeout(() => {
            electron.autoUpdater.checkForUpdates();
        }, 5000);
    }, (e) => {
        // Error downloading manifest; be permissive on banned version check
        Telemetry.tickEvent("update.error.fetchmanifestfailed");
        return updateStatusDeferred.resolve("ok" /* Ok */);
    })
        .catch((e) => {
        // Uncaught error while updating
        if (updateStatusDeferred.promise.isResolved) {
            updateStatusDeferred.promise.then((status) => {
                Telemetry.tickEvent("update.error.unknown", { status });
                if (status === "updating-critical" /* UpdatingCritical */) {
                    ipc.sendCriticalUpdateFailed();
                }
            });
        }
        else {
            // The error happened before we could perform the banned version check; be permissive
            Telemetry.tickEvent("update.error.unknown");
            updateStatusDeferred.resolve("ok" /* Ok */);
        }
    });
}
exports.init = init;
function getUpdateUrl(updateVersion) {
    let url;
    switch (process.platform) {
        case "win32":
            url = productloader_1.default.windows.updateUrl;
            break;
        case "darwin":
            url = productloader_1.default.macos.updateUrl;
            break;
        default:
            // Auto updates are not supported for this platform
            return null;
    }
    url = url.replace(/{{version}}/, updateVersion);
    return url;
}
function isUpdateEnabled() {
    return !isDev &&
        !!productloader_1.default.targetConfigUrl &&
        !!getUpdateUrl("test") && // Builds a fake update URL to ensure a URL is defined in the product
        (process.platform === "win32" || process.platform === "darwin");
}
//# sourceMappingURL=updateService.js.map