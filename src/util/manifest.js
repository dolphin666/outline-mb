"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const path = require("path");
const productloader_1 = require("../util/productloader");
const Promise = require("bluebird");
const Util = require("../util/util");
const Telemetry = require("../util/telemetry");
const cacheRoot = path.join(os.tmpdir(), `${productloader_1.default.shortName}-manifestcache`);
const targetConfigFileName = "targetconfig.json";
const cachedTargetConfigPath = path.join(cacheRoot, targetConfigFileName);
const cacheMaxAgeMs = 15 * 60 * 1000;
let getManifestPromise = null;
/**
 * Gets the target's release manifest. Try to use a cached copy first, but if there is none, or if the cache is
 * outdated, download a new one by using the URL specified in the product info. The release manifest is cached after
 * download.
 */
function getElectronManifestAsync() {
    if (getManifestPromise) {
        return getManifestPromise;
    }
    getManifestPromise = Promise.resolve()
        .then(() => {
        Util.mkdirP(cacheRoot);
        return Util.readJsonFileAsync(cachedTargetConfigPath);
    })
        .then((targetConfig) => {
        if (targetConfig && targetConfig.electronManifest) {
            const cachedTime = Date.parse(targetConfig.electronManifest.timeStamp);
            const currentTime = Date.parse((new Date()).toISOString());
            if (!isNaN(cachedTime) && currentTime - cachedTime <= cacheMaxAgeMs) {
                return Promise.resolve(targetConfig.electronManifest);
            }
        }
        return downloadTargetConfigAsync()
            .then((liveTargetConfig) => {
            if (!liveTargetConfig) {
                return Promise.reject(new Error(`Empty targetconfig received`));
            }
            return Promise.resolve(liveTargetConfig.electronManifest);
        })
            .catch((e) => {
            Telemetry.tickEvent("livetargetconfig.failed");
            // Error downloading a new manifest; if we had one in the cache, fallback to that even if it
            // was outdated
            if (targetConfig && targetConfig.electronManifest) {
                return targetConfig.electronManifest;
            }
            // If not, propagate the error
            throw new Error(`Error downloading targetconfig: ${e}`);
        });
    })
        .finally(() => {
        getManifestPromise = null;
    });
    return getManifestPromise;
}
exports.getElectronManifestAsync = getElectronManifestAsync;
function downloadTargetConfigAsync() {
    if (!productloader_1.default.targetConfigUrl) {
        return Promise.reject(null);
    }
    return Util.requestJsonAsync({ url: productloader_1.default.targetConfigUrl })
        .then((targetConfig) => {
        return cacheTargetConfigAsync(targetConfig)
            .catch((e) => {
            Telemetry.tickEvent("electron.update.cachemanifesterror");
            // No-op; failing to cache the manifest is not a critical error
            console.log(`Error caching the release manifest: ${e}`);
        })
            .then(() => targetConfig);
    });
}
function cacheTargetConfigAsync(targetConfig) {
    if (!targetConfig.electronManifest) {
        targetConfig.electronManifest = {
            latest: undefined
        };
    }
    targetConfig.electronManifest.timeStamp = (new Date()).toISOString();
    return Util.fsWriteFilePromise(cachedTargetConfigPath, JSON.stringify(targetConfig));
}
//# sourceMappingURL=manifest.js.map