"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const schema_js_1 = require("../../db/schema.js");
const logAudit = async (db, params) => {
    await db.insert(schema_js_1.auditLogs).values({
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        description: params.description,
        details: params.details ?? null,
    });
};
exports.logAudit = logAudit;
