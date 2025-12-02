"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
__exportStar(require("./llmstxt"), exports);
__exportStar(require("./robots"), exports);
__exportStar(require("./types"), exports);
const llmstxt_1 = require("./llmstxt");
const robots_1 = require("./robots");
async function validate(url, options) {
    const result = {
        url,
        score: 0,
        checks: []
    };
    // Phase 1: LLMs.txt validation
    const llmsCheck = await (0, llmstxt_1.validateLllmsTxt)(url);
    result.checks.push(...llmsCheck);
    const robotsCheck = await (0, robots_1.validateRobotsTxt)(url);
    result.checks.push(...robotsCheck);
    // Calculate score (simplistic for now)
    const passed = result.checks.filter(c => c.status === 'pass').length;
    const total = result.checks.length;
    result.score = total > 0 ? Math.round((passed / total) * 100) : 0;
    return result;
}
