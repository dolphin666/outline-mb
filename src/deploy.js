"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ipc = require("./util/ipc");
const path = require("path");
const productLoader_1 = require("./util/productLoader");
const Promise = require("bluebird");
const telemetry = require("./util/telemetry");
const util = require("./util/util");
const manifestDownload = require("./util/manifest");
const NATIVE_TYPE_CS = "C#";
const BINARY_CS = "binary.cs";
const BINARY_HEX = "binary.hex";
const BINARY_UF2 = "binary.uf2";
const BINARY_ELF = "binary.elf";
let isDriveDeployBanned = false;
function initDriveDeploy() {
    if (productLoader_1.default.allowDriveDeploy) {
        ipc.onDriveDeploy((res) => driveDeploy(res));
        manifestDownload.getElectronManifestAsync()
            .then((manifest) => {
            if (manifest.isDriveDeployBanned) {
                isDriveDeployBanned = true;
            }
        });
    }
    else {
        ipc.onDriveDeploy(() => {
            ipc.sendDriveDeployResult(false);
        });
    }
}
exports.initDriveDeploy = initDriveDeploy;
function outputName() {
    const trg = productLoader_1.default.target.compile;
    if (trg.nativeType == NATIVE_TYPE_CS) {
        return BINARY_CS;
    }
    if (trg.useUF2) {
        return BINARY_UF2;
    }
    if (trg.useELF) {
        return BINARY_ELF;
    }
    return BINARY_HEX;
}
function isOutputText() {
    const output = outputName();
    return output === BINARY_HEX || output == BINARY_CS;
}
function driveDeploy(compileResult) {
    function sendResult(isSuccess) {
        ipc.sendDriveDeployResult(isSuccess);
    }
    if (!productLoader_1.default.allowDriveDeploy || isDriveDeployBanned) {
        telemetry.tickEvent("drivedeploy.unauthorized", {
            allowDriveDeploy: productLoader_1.default.allowDriveDeploy ? "true" : "false",
            isDriveDeployBanned: isDriveDeployBanned ? "true" : "false"
        });
        return sendResult(false);
    }
    const firmware = outputName();
    const encoding = isOutputText() ? "utf8" : "base64";
    getBoardDrivesAsync()
        .then(drives => {
        if (drives.length == 0) {
            sendResult(false);
            return Promise.resolve();
        }
        const writeHexFile = (filename) => {
            return util.fsWriteFileOptsPromise(path.join(filename, firmware), compileResult.outfiles[firmware], { encoding });
        };
        return Promise.map(drives, d => writeHexFile(d))
            .then(() => {
            sendResult(true);
        });
    });
}
function getBoardDrivesAsync() {
    if (!productLoader_1.default.target || !productLoader_1.default.target.compile || !productLoader_1.default.target.compile.deployDrives) {
        return Promise.resolve([]);
    }
    if (process.platform == "win32") {
        const rx = new RegExp("^([A-Z]:)\\s+(\\d+).* " + productLoader_1.default.target.compile.deployDrives);
        return util.cpExecPromise("wmic PATH Win32_LogicalDisk get DeviceID, VolumeName, FileSystem, DriveType")
            .then((buf) => {
            let res = [];
            buf.toString("utf8").split(/\n/).forEach(ln => {
                let m = rx.exec(ln);
                if (m && m[2] == "2") {
                    res.push(m[1] + "/");
                }
            });
            return res;
        });
    }
    else if (process.platform == "darwin") {
        const rx = new RegExp(productLoader_1.default.target.compile.deployDrives);
        return util.fsReaddirPromise("/Volumes")
            .then(lst => lst.filter(s => rx.test(s)).map(s => "/Volumes/" + s + "/"));
    }
    else if (process.platform == "linux") {
        const rx = new RegExp(productLoader_1.default.target.compile.deployDrives);
        const user = process.env["USER"];
        return util.fsReaddirPromise(`/media/${user}`)
            .then(lst => lst.filter(s => rx.test(s)).map(s => `/media/${user}/${s}/`));
    }
    else {
        return Promise.resolve([]);
    }
}
//# sourceMappingURL=deploy.js.map