"use strict";
/// <reference path="../out/pxttypings/pxtarget.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const getport = require("get-port");
const http = require("http");
const path = require("path");
const productLoader_1 = require("./util/productLoader");
const Promise = require("bluebird");
const url = require("url");
const Util = require("./util/util");
const Telemetry = require("./util/telemetry");
const Workspace = require("./workspace");
const ecstatic = require("ecstatic");
const defaultPort = 54345;
const serveRoot = path.resolve(__dirname, "..", "packaged");
// The following are chosen so their difference, 16381, is prime
const minPort = 49153;
const maxPort = 65534;
class StaticServer {
    static get instance() {
        if (!StaticServer._instance) {
            StaticServer._instance = new StaticServer;
        }
        return StaticServer._instance;
    }
    get url() {
        return `http://localhost:${this.port}`;
    }
    get serveRoot() {
        return serveRoot;
    }
    get port() {
        return this.listeningPort;
    }
    get localToken() {
        return this.token;
    }
    constructor() {
        // Empty
    }
    start() {
        if (this.server && !this.server.listening) {
            this.dispose();
        }
        this.token = Util.guidGen();
        return Promise.resolve()
            .then(() => {
            return getport({
                port: this.getPreferredPort(),
                host: "127.0.0.1"
            });
        })
            .then((port) => {
            this.listeningPort = port;
            const opts = {
                root: serveRoot,
                cache: "no-cache, no-store",
                showDir: false,
                hidePermissions: true,
                headers: { "Access-Control-Allow-Origin": this.url },
                autoIndex: false
            };
            const ecstaticHandler = ecstatic(opts);
            Workspace.init(productLoader_1.default.target.nickname || productLoader_1.default.target.name);
            this.server = http.createServer((req, res) => this.handleRequest(req, res, ecstaticHandler));
            this.server.listen(port, "127.0.0.1");
            return Promise.resolve();
        });
    }
    dispose() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.listeningPort = null;
    }
    /**
     * Handles a request to the local static server
     */
    handleRequest(req, res, ecstaticHandler) {
        const error = (code, msg = null) => {
            Telemetry.tickEvent("workspace.apierror", { code });
            res.writeHead(code, { "Content-Type": "text/plain" });
            res.end(msg || "Error " + code);
        };
        const redirectEmbedUrl = (customPath) => {
            const embedUrlNoSlash = productLoader_1.default.target.appTheme.embedUrl.replace(/\/$/, "");
            const redirectUrl = embedUrlNoSlash + "/" + customPath.replace(/^\//, "");
            res.statusCode = 307;
            res.setHeader("Location", redirectUrl);
            res.end();
        };
        const parsed = url.parse(req.url);
        parsed.pathname = parsed.pathname.replace(/^\/\.\//, "/"); // Change /./api/foo to /api/foo
        const pathParts = parsed.pathname.split("/").filter(p => !!p);
        const isGet = req.method.toUpperCase() === "GET";
        const isApiRequest = pathParts[0] === "api";
        const isIndexHtml = pathParts[0] === "index.html";
        const hasLocalTokenQuery = (new RegExp(`local_token=${this.localToken}`)).test(parsed.query);
        if ((isIndexHtml && !hasLocalTokenQuery) || (!isGet && !isApiRequest)) {
            return error(403);
        }
        if (isApiRequest) {
            if (!this.isAuthorizedApiRequest(req) && pathParts[1] !== "md") {
                return error(403);
            }
            Workspace.handleApiRequestAsync(req, pathParts)
                .then(data => this.sendJson(res, data), err => {
                if (err.statusCode) {
                    error(err.statusCode, err.message || "");
                }
                else {
                    error(500);
                }
            });
        }
        else {
            const isCdn = pathParts[0] === "cdn";
            const isUnderDocs = pathParts[0] === "docs";
            const isUnderStatic = pathParts[0] === "static";
            const ext = path.extname(parsed.pathname);
            const hasExt = !!ext;
            if (isCdn) {
                // Rewrite /cdn/foo to /foo
                parsed.pathname = parsed.pathname.replace("cdn/", "");
            }
            if (isUnderDocs && !hasExt) {
                // Default to .md files under /docs
                parsed.pathname = `${parsed.pathname}.md`;
            }
            if (isUnderStatic) {
                parsed.pathname = `/docs${parsed.pathname}`;
            }
            if (!isCdn && !isUnderDocs && !isUnderStatic && !hasExt) {
                // The request is localhost:port/foo. That is probably an HTML file under /docs. If that file exists,
                // serve that. If it doesn't, our best bet is to redirect to the online URL.
                const potentialFile = `/docs${parsed.pathname}.html`;
                if (fs.existsSync(path.join(this.serveRoot, potentialFile))) {
                    parsed.pathname = potentialFile;
                }
                else {
                    return redirectEmbedUrl(parsed.pathname);
                }
            }
            // If the request is for a markdown file under docs/, and that file is not in the packaged app, then it is
            // a doc file that we do not package for offline use. Redirect to the online URL.
            if (isUnderDocs && !fs.existsSync(path.join(this.serveRoot, parsed.pathname)) && ext === ".md") {
                const slicedPath = pathParts.slice(1);
                slicedPath[slicedPath.length - 1] = slicedPath[slicedPath.length - 1].replace(/\.md\/?$/, "");
                const redirectPath = `api/md/${productLoader_1.default.target.id}/${slicedPath.join("/")}?targetVersion=${productLoader_1.default.target.versions.target.replace(/^v/, "")}`;
                return redirectEmbedUrl(redirectPath);
            }
            req.url = url.format(parsed);
            ecstaticHandler(req, res);
        }
    }
    /**
     * Return a json response
     */
    sendJson(res, data) {
        if (typeof data == "string") {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf8' });
            res.end(data);
        }
        else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf8' });
            res.end(JSON.stringify(data));
        }
    }
    /**
     * Hashes the target's name to determine a preferred port
     */
    getPreferredPort() {
        if (!productLoader_1.default.target || !productLoader_1.default.target.name) {
            return defaultPort;
        }
        const hashValue = Util.hash(productLoader_1.default.target.name);
        let port = hashValue % (maxPort - minPort);
        if (port < 0) {
            port = Math.abs(port);
        }
        port += minPort;
        return Math.abs(port);
    }
    isAuthorizedApiRequest(req) {
        return req.headers["authorization"] && req.headers["authorization"] == this.localToken;
    }
}
exports.StaticServer = StaticServer;
//# sourceMappingURL=staticServer.js.map