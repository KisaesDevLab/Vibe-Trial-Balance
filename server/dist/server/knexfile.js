"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const config = {
    development: {
        client: 'pg',
        connection: {
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'trialbalance_db',
            user: process.env.DB_USER || 'trialbalance',
            password: process.env.DB_PASSWORD || 'localdev123',
        },
        pool: { min: 2, max: 10 },
        migrations: {
            tableName: 'knex_migrations',
            directory: path_1.default.resolve(__dirname, 'migrations'),
            extension: 'ts',
        },
        seeds: {
            directory: path_1.default.resolve(__dirname, 'seeds'),
            extension: 'ts',
        },
    },
};
exports.default = config;
//# sourceMappingURL=knexfile.js.map