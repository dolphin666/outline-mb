"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const Promise = require("bluebird");
const url = require("url");
const zlib = require("zlib");
const crypto_1 = require("crypto");
exports.fsReaddirPromise = Promise.promisify(fs.readdir);
exports.fsReadFilePromise = Promise.promisify(fs.readFile);
exports.fsRenamePromise = Promise.promisify(fs.rename);
exports.fsStatPromise = Promise.promisify(fs.stat);
exports.fsUnlinkPromise = Promise.promisify(fs.unlink);
exports.fsWriteFilePromise = Promise.promisify(fs.writeFile);
exports.fsWriteFileOptsPromise = Promise.promisify(fs.writeFile);
exports.cpExecPromise = Promise.promisify(child_process.exec);
/**
 * https://stackoverflow.com/a/7616484
 */
function hash(str) {
    let hash = 0;
    let i;
    let chr;
    if (str.length === 0) {
        return hash;
    }
    for (i = 0; i < str.length; ++i) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}
exports.hash = hash;
function guidGen() {
    function f() { return (randomUint32() | 0x10000).toString(16).slice(-4); }
    return f() + f() + "-" + f() + "-4" + f().slice(-3) + "-" + f() + "-" + f() + f() + f();
}
exports.guidGen = guidGen;
function randomUint32() {
    let buf = new Uint8Array(4);
    getRandomBuf(buf);
    return new Uint32Array(buf.buffer)[0];
}
function getRandomBuf(buf) {
    let tmp = crypto_1.randomBytes(buf.length);
    for (let i = 0; i < buf.length; ++i)
        buf[i] = tmp[i];
}
function pushRange(trg, src) {
    for (let i = 0; i < src.length; ++i)
        trg.push(src[i]);
}
exports.pushRange = pushRange;
function concat(arrays) {
    let r = [];
    for (let i = 0; i < arrays.length; ++i) {
        pushRange(r, arrays[i]);
    }
    return r;
}
exports.concat = concat;
function retryAsync(operation, maxTries, delay = 200) {
    return operation()
        .catch((e) => {
        if (maxTries > 0) {
            return Promise.delay(delay)
                .then(() => {
                return retryAsync(operation, maxTries - 1, delay);
            });
        }
        return Promise.reject(e);
    });
}
exports.retryAsync = retryAsync;
function mkdirP(thePath) {
    if (thePath == ".")
        return;
    if (!fs.existsSync(thePath)) {
        mkdirP(path.dirname(thePath));
        fs.mkdirSync(thePath);
    }
}
exports.mkdirP = mkdirP;
function fileExistsAsync(thePath) {
    return exports.fsStatPromise(thePath)
        .then((stats) => {
        return true;
    })
        .catch((e) => {
        return false;
    });
}
exports.fileExistsAsync = fileExistsAsync;
function readJsonFileAsync(thePath) {
    return fileExistsAsync(thePath)
        .then((exists) => {
        if (!exists) {
            return Promise.resolve(null);
        }
        return exports.fsReadFilePromise(thePath, "utf8");
    })
        .then((content) => {
        return JSON.parse(content);
    });
}
exports.readJsonFileAsync = readJsonFileAsync;
function writeJsonFileAsync(content, thePath) {
    return exports.fsWriteFilePromise(thePath, JSON.stringify(content));
}
exports.writeJsonFileAsync = writeJsonFileAsync;
function readResAsync(g) {
    return new Promise((resolve, reject) => {
        let bufs = [];
        g.on('data', (c) => {
            if (typeof c === "string")
                bufs.push(new Buffer(c, "utf8"));
            else
                bufs.push(c);
        });
        g.on("error", (err) => reject(err));
        g.on('end', () => resolve(Buffer.concat(bufs)));
    });
}
exports.readResAsync = readResAsync;
function requestAsStreamAsync(options) {
    return new Promise((resolve, reject) => {
        const endpoint = url.parse(options.url);
        const rawRequest = endpoint.protocol === 'https:' ? https.request : http.request;
        const opts = {
            hostname: endpoint.hostname,
            port: endpoint.port ? parseInt(endpoint.port) : (endpoint.protocol === 'https:' ? 443 : 80),
            path: endpoint.path,
            method: options.type || 'GET',
            headers: options.headers,
            agent: options.agent,
            rejectUnauthorized: isBoolean(options.strictSSL) ? options.strictSSL : true
        };
        if (options.user && options.password) {
            opts.auth = options.user + ':' + options.password;
        }
        const req = rawRequest(opts, (res) => {
            const followRedirects = isNumber(options.followRedirects) ? options.followRedirects : 3;
            if (res.statusCode >= 300 && res.statusCode < 400 && followRedirects > 0 && res.headers['location']) {
                requestAsStreamAsync(Object.assign({}, options, {
                    url: res.headers['location'],
                    followRedirects: followRedirects - 1
                })).done(resolve, reject);
            }
            else {
                let stream = res;
                if (res.headers['content-encoding'] === 'gzip') {
                    stream = stream.pipe(zlib.createGunzip());
                }
                resolve({ req, res, stream });
            }
        });
        req.on('error', (e) => {
            reject(e);
        });
        if (options.timeout) {
            req.setTimeout(options.timeout);
        }
        if (options.data) {
            req.write(options.data);
        }
        req.end();
    });
}
exports.requestAsStreamAsync = requestAsStreamAsync;
function downloadAsync(filePath, context) {
    if (!isHttpSuccess(context)) {
        return Promise.reject(new Error("Bad HTTP status: " + context.res.statusCode));
    }
    return new Promise((resolve, reject) => {
        const out = fs.createWriteStream(filePath);
        out.once("finish", resolve);
        context.stream.once("error", reject);
        context.stream.pipe(out);
    });
}
exports.downloadAsync = downloadAsync;
function asJsonAsync(context, ignoreBadStatus = false) {
    return asStringAsync(context, ignoreBadStatus)
        .then((msg) => {
        let jsonContent = null;
        try {
            jsonContent = JSON.parse(msg);
        }
        catch (e) {
            return Promise.reject(new Error("Response doesn't appear to be JSON"));
        }
        return Promise.resolve(jsonContent);
    });
}
exports.asJsonAsync = asJsonAsync;
function asStringAsync(context, ignoreBadStatus = false) {
    return new Promise((resolve, reject) => {
        if (!ignoreBadStatus && !isHttpSuccess(context)) {
            reject(new Error("Bad HTTP status: " + context.res.statusCode));
        }
        if (hasNoContent(context)) {
            resolve(null);
        }
        const buffer = [];
        context.stream.on("data", (d) => buffer.push(d));
        context.stream.on("end", () => {
            const content = buffer.join("");
            resolve(content);
        });
        context.stream.on("error", (e) => {
            reject(e);
        });
    });
}
exports.asStringAsync = asStringAsync;
function requestJsonAsync(options, ignoreBadStatus = false) {
    return requestAsStreamAsync(options)
        .then((context) => {
        return asJsonAsync(context, ignoreBadStatus);
    });
}
exports.requestJsonAsync = requestJsonAsync;
function isHttpSuccess(context) {
    return (context.res.statusCode >= 200 && context.res.statusCode < 300) || context.res.statusCode === 1223;
}
exports.isHttpSuccess = isHttpSuccess;
function hasNoContent(context) {
    return context.res.statusCode === 204;
}
function isNumber(obj) {
    if ((typeof (obj) === "number" || obj instanceof Number) && !isNaN(obj)) {
        return true;
    }
    return false;
}
function isBoolean(obj) {
    return obj === true || obj === false;
}
//# sourceMappingURL=util.js.map