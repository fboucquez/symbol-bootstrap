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

import { join, resolve } from 'path';
import * as winston from 'winston';
import { FileTransportInstance } from 'winston/lib/winston/transports';
import { BootstrapUtils } from '../service';
import { Logger } from './Logger';
import { LogType } from './LogType';

export class LoggerFactory {
    private static readonly consoleTransport = new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.cli(),
            winston.format.printf((i) => `${i.timestamp} ${i.level} ${i.message}`),
        ),
    });

    private static readonly consoleOnlyTransport = new winston.transports.Console({
        format: winston.format.combine(
            winston.format.printf((i) => {
                if (i.level.includes('info')) {
                    return `${i.message}`;
                } else {
                    return `${i.message} (${i.level.toUpperCase()})`;
                }
            }),
        ),
    });

    private static readonly fileTransport = (fileName: string): FileTransportInstance =>
        new winston.transports.File({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf((i) => `${i.timestamp} ${i.level} ${i.message}`),
            ),
            options: { flags: 'w' },
            filename: resolve(fileName),
            level: 'info',
        });

    public static getLogger(id: LogType, workingDir = BootstrapUtils.defaultWorkingDir): Logger {
        if (!winston.loggers.has(id.toString())) {
            switch (id) {
                case LogType.System:
                    winston.loggers.add(id.toString(), {
                        transports: [LoggerFactory.consoleTransport, LoggerFactory.fileTransport(join(workingDir, 'logs.log'))],
                        format: winston.format.label({ label: id.toString() }),
                    });
                    break;
                case LogType.Console:
                    winston.loggers.add(id.toString(), {
                        transports: [LoggerFactory.consoleOnlyTransport],
                        format: winston.format.label({ label: id.toString() }),
                    });
                    break;
                case LogType.ConsoleLog:
                    winston.loggers.add(id.toString(), {
                        transports: [LoggerFactory.consoleTransport],
                        format: winston.format.label({ label: id.toString() }),
                    });
                    break;
                case LogType.Silence:
                    winston.loggers.add(id.toString(), {
                        transports: [
                            new winston.transports.Console({
                                silent: true,
                            }),
                        ],
                        format: winston.format.label({ label: id.toString() }),
                    });
                    break;
                default:
                    throw new Error(`Unknown LogType ${id}`);
            }
        }
        return winston.loggers.get(id.toString());
    }
}
