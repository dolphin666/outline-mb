"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Promise = require("bluebird");
const rimraf = require("rimraf");
const Telemetry = require("./util/telemetry");
const util_1 = require("./util/util");
const CONFIG_NAME = "pxt.json";
const HEADER_JSON = ".header.json";
const statAsync = Promise.promisify(fs.stat);
const readdirAsync = Promise.promisify(fs.readdir);
const readFileAsync = Promise.promisify(fs.readFile);
const writeFileAsync = Promise.promisify(fs.writeFile);
function existsAsync(fn) {
    return new Promise((resolve, reject) => {
        fs.exists(fn, resolve);
    });
}
function statOptAsync(fn) {
    return statAsync(fn)
        .then(st => st, err => null);
}
function init(targetNickname) {
    if (process.platform === "win32") {
        // Use registry to query path of My Documents folder
        let regQueryResult = "";
        try {
            let regQueryResult = child_process_1.execSync("reg query \"HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders\" /v Personal").toString();
            let documentsPath = /personal(?:\s+\w+)\s+(.*)/gmi.exec(regQueryResult)[1];
            if (documentsPath) {
                exports.documentsRoot = documentsPath;
            }
        }
        catch (e) {
            // Silently swallow and set the projects root to the home dir (below)
        }
    }
    if (!exports.documentsRoot) {
        exports.documentsRoot = os.homedir();
    }
    exports.makeCodeRoot = path.resolve(exports.documentsRoot, "MakeCode");
    exports.projectsDir = path.resolve(exports.makeCodeRoot, targetNickname);
    util_1.mkdirP(exports.projectsDir);
}
exports.init = init;
function handleApiRequestAsync(req, elts) {
    const readJsonAsync = () => {
        return util_1.readResAsync(req)
            .then(buf => JSON.parse(buf.toString("utf8")));
    };
    const innerPath = elts.slice(2).join("/").replace(/^\//, "");
    const meth = req.method.toUpperCase();
    const cmd = meth + " " + elts[1];
    if (cmd == "GET list") {
        return returnDirAsync(innerPath, 3)
            .then(lst => {
            return {
                pkgs: lst
            };
        });
    }
    else if (cmd == "GET pkg") {
        return readPkgAsync(innerPath, true);
    }
    else if (cmd == "POST pkg") {
        return readJsonAsync()
            .then(d => writePkgAsync(innerPath, d));
    }
    else if (cmd == "POST resetworkspace") {
        return resetWorkspace();
    }
    else {
        throw throwError(400, `unknown command ${cmd.slice(0, 140)}`);
    }
}
exports.handleApiRequestAsync = handleApiRequestAsync;
function throwError(code, msg = null) {
    let err = new Error(msg || "Error " + code);
    err.statusCode = code;
    throw err;
}
function readPkgAsync(logicalDirname, fileContents = false) {
    logicalDirname = logicalDirname.replace(/^\//, "");
    const dirname = path.resolve(exports.projectsDir, logicalDirname);
    // Ensure the project dir is not outside the allowed folder
    const isUnauthorizedDir = !dirname.startsWith(exports.projectsDir);
    if (isUnauthorizedDir) {
        Telemetry.tickEvent("workspace.unauthorizedreadpkg");
        throwError(403);
    }
    let r = undefined;
    return readFileAsync(path.join(dirname, CONFIG_NAME))
        .then(buf => {
        let cfg = JSON.parse(buf.toString("utf8"));
        let files = [CONFIG_NAME].concat(cfg.files || []).concat(cfg.testFiles || []);
        return Promise.map(files, fn => {
            const fullFile = path.resolve(dirname, fn);
            // Ensure the file is not outside the allowed folder
            const isUnauthorizedFile = !fullFile.startsWith(exports.projectsDir);
            if (isUnauthorizedFile) {
                Telemetry.tickEvent("workspace.unauthorizedreadpkg");
                throwError(403);
            }
            return statOptAsync(fullFile)
                .then(st => {
                let r = {
                    name: fn,
                    mtime: st ? st.mtime.getTime() : null
                };
                if (st == null || !fileContents)
                    return r;
                else
                    return readFileAsync(fullFile)
                        .then(buf => {
                        r.content = buf.toString("utf8");
                        return r;
                    });
            });
        })
            .then(files => {
            r = {
                path: logicalDirname,
                config: cfg,
                files: files
            };
            return existsAsync(path.join(dirname, "icon.jpeg"));
        })
            .then(icon => {
            r.icon = icon ? "/icon/" + logicalDirname : undefined;
            return existsAsync(path.join(dirname, HEADER_JSON));
        })
            .then(headerExists => {
            if (headerExists) {
                return readFileAsync(path.join(dirname, HEADER_JSON));
            }
            else {
                return undefined;
            }
        })
            .then(header => {
            if (header && header.length) {
                r.header = JSON.parse(header.toString("utf8"));
            }
            return r;
        });
    });
}
function returnDirAsync(logicalDirname, depth) {
    logicalDirname = logicalDirname.replace(/^\//, "");
    const dirname = path.resolve(exports.projectsDir, logicalDirname);
    // Ensure the project dir is not outside the allowed folder
    const isUnauthorizedDir = !dirname.startsWith(exports.projectsDir);
    if (isUnauthorizedDir) {
        Telemetry.tickEvent("workspace.unauthorizedreaddir");
        throwError(403);
    }
    return existsAsync(path.join(dirname, CONFIG_NAME))
        .then(ispkg => ispkg ? readPkgAsync(logicalDirname).then(r => [r], err => []) :
        depth <= 1 ? [] :
            readdirAsync(dirname)
                .then(files => Promise.map(files, fn => statAsync(path.join(dirname, fn))
                .then(st => {
                if (fn[0] != "." && st.isDirectory())
                    return returnDirAsync(logicalDirname + "/" + fn, depth - 1);
                else
                    return [];
            })))
                .then(util_1.concat));
}
function writePkgAsync(logicalDirname, data) {
    const dirname = path.resolve(exports.projectsDir, logicalDirname);
    // Ensure the project dir and all files are not outside the allowed folder
    const isUnauthorizedDir = !dirname.startsWith(exports.projectsDir);
    const hasUnauthorizedFiles = data.files.some((f) => {
        const fullFile = path.resolve(dirname, f.name);
        return !fullFile.startsWith(exports.projectsDir); // returns true for unauthorized, false for ok
    });
    if (isUnauthorizedDir || hasUnauthorizedFiles) {
        Telemetry.tickEvent("workspace.unauthorizedwrite");
        throwError(403);
    }
    if (data.isDeleted) {
        return new Promise((resolve, reject) => {
            rimraf(dirname, (err) => {
                if (err) {
                    // Best effort delete; worst case the project will be there next time the app is launched
                    Telemetry.tickEvent("workspace.delete.error");
                }
                resolve(data);
            });
        });
    }
    util_1.mkdirP(dirname);
    return Promise.map(data.files, f => readFileAsync(path.join(dirname, f.name))
        .then(buf => {
        if (f.name == CONFIG_NAME) {
            try {
                let cfg = JSON.parse(f.content);
                if (!cfg.name) {
                    return throwError(410);
                }
            }
            catch (e) {
                throwError(410);
            }
        }
        if (buf.toString("utf8") !== f.prevContent) {
            throwError(409);
        }
    }, err => { }))
        .then(() => Promise.map(data.files, f => writeFileAsync(path.join(dirname, f.name), f.content)))
        .then(() => {
        if (data.header) {
            const headerLocation = path.join(dirname, HEADER_JSON);
            const headerData = JSON.stringify(data.header, null, 4);
            return writeFileAsync(headerLocation, headerData);
        }
        else {
            return undefined;
        }
    })
        .then(() => readPkgAsync(logicalDirname, false));
}
function resetWorkspace() {
    return new Promise((resolve, reject) => {
        rimraf(exports.projectsDir, (err) => {
            if (err) {
                // Best effort reset; some projects might still be there on next app launch
                Telemetry.tickEvent("workspace.reset.error");
            }
            util_1.mkdirP(exports.projectsDir);
            resolve({
                config: null,
                files: [],
                path: ""
            });
        });
    });
}
//# sourceMappingURL=workspace.js.map