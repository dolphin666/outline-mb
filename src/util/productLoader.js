"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const productJsonPath = path.join(__dirname, "..", "product.json");
const targetJsonPath = path.join(__dirname, "..", "..", "packaged", "target.json");
const product = require(productJsonPath);
product.target = require(targetJsonPath);
exports.default = product;
//# sourceMappingURL=productLoader.js.map