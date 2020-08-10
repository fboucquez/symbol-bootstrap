import { resolve } from 'path';
import * as winston from 'winston';
import { LogType } from './LogType';
import { FileTransportInstance } from 'winston/lib/winston/transports';
import Logger from './Logger';

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

    public static getLogger(id: LogType): Logger {
        if (!winston.loggers.has(id.toString())) {
            winston.loggers.add(id.toString(), {
                transports: [LoggerFactory.consoleTransport, LoggerFactory.fileTransport(id)],
                format: winston.format.label({ label: id.toString() }),
            });
        }
        return winston.loggers.get(id.toString());
    }

    private static logFormatTemplate(i: { level: string; message: string; [key: string]: any }): string {
        return `${i.timestamp} ${i.level} [${i.label}] ${i.message}`;
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
