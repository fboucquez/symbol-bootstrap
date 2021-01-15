/*
 * Copyright 2020 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { resolve } from 'path';
import * as winston from 'winston';
import { FileTransportInstance } from 'winston/lib/winston/transports';
import Logger from './Logger';
import { LogType } from './LogType';

export default class LoggerFactory {
    private static readonly consoleTransport = new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.cli(),
            winston.format.printf(LoggerFactory.logFormatTemplate),
        ),
    });

    private static readonly fileTransport = (id: LogType): FileTransportInstance =>
        new winston.transports.File({
            format: winston.format.combine(winston.format.timestamp(), winston.format.printf(LoggerFactory.logFormatTemplate)),
            options: { flags: 'w' },
            filename: resolve(LoggerFactory.getLogFileName(id)),
            level: 'info',
        });

    public static getLogger(id = LogType.System): Logger {
        if (!winston.loggers.has(id.toString())) {
            winston.loggers.add(id.toString(), {
                transports: [LoggerFactory.consoleTransport, LoggerFactory.fileTransport(id)],
                format: winston.format.label({ label: id.toString() }),
            });
        }
        return winston.loggers.get(id.toString());
    }

    private static logFormatTemplate(i: { level: string; message: string; [key: string]: any }): string {
        return `${i.timestamp} ${i.level} ${i.message}`;
    }

    private static getLogFileName(id: LogType): string {
        switch (id) {
            case LogType.Audit:
                return 'auditLogs.log';
            case LogType.System:
            default:
                return 'logs.log';
        }
    }
}
