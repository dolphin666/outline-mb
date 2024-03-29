(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
/// <reference path="../node_modules/pxt-core/built/pxteditor.d.ts"/>
/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts"/>
Object.defineProperty(exports, "__esModule", { value: true });
var field_gestures_1 = require("./field_gestures");
pxt.editor.initFieldExtensionsAsync = function (opts) {
    pxt.debug('loading pxt-microbit field editors...');
    var res = {
        fieldEditors: [{
                selector: "gestures",
                editor: field_gestures_1.FieldGestures
            }]
    };
    return Promise.resolve(res);
};

},{"./field_gestures":2}],2:[function(require,module,exports){
"use strict";
/// <reference path="../node_modules/pxt-core/localtypings/blockly.d.ts"/>
/// <reference path="../node_modules/pxt-core/built/pxtblocks.d.ts"/>
/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var FieldGestures = /** @class */ (function (_super) {
    __extends(FieldGestures, _super);
    function FieldGestures(text, options, validator) {
        var _this = _super.call(this, text, options, validator) || this;
        _this.isFieldCustom_ = true;
        _this.buttonClick_ = function (e) {
            var value = e.target.getAttribute('data-value');
            this.setValue(value);
            Blockly.DropDownDiv.hide();
        };
        _this.columns_ = parseInt(options.columns) || 4;
        _this.width_ = parseInt(options.width) || 350;
        _this.addLabel_ = true;
        _this.setText = Blockly.FieldDropdown.prototype.setText;
        _this.updateWidth = Blockly.Field.prototype.updateWidth;
        _this.updateTextNode_ = Blockly.Field.prototype.updateTextNode_;
        return _this;
    }
    FieldGestures.prototype.trimOptions_ = function () {
    };
    return FieldGestures;
}(pxtblockly.FieldImages));
exports.FieldGestures = FieldGestures;

},{}]},{},[1,2]);
