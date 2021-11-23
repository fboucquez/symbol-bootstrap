import { expect } from 'chai';
import { it } from 'mocha';
import { LoggerFactory } from '../../src';

describe('LoggerFactory', () => {
    it('getLogger file', () => {
        const logger = LoggerFactory.getLogger('FiLe');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0]._basename).equals('logs.log');
        expect(transports[0].name).equals('file');
    });

    it('getLogger console', () => {
        const logger = LoggerFactory.getLogger('console');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].name).equals('console');
    });

    it('getLogger console log', () => {
        const logger = LoggerFactory.getLogger('consoleLOG');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].name).equals('console');
    });

    it('getLogger silent', () => {
        const logger = LoggerFactory.getLogger('SILENT');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].silent).equals(true);
        expect(transports[0].name).equals('console');
    });

    it('getLogger multiple', () => {
        const logger = LoggerFactory.getLogger('consoleLOG , , File,SILENT');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(3);
        expect(transports[0].name).equals('console');
        expect(transports[1].name).equals('file');
        expect(transports[1]._basename).equals('logs.log');
        expect(transports[2].name).equals('console');
        expect(transports[2].silent).equals(true);
    });

    it('getLogger invalid', () => {
        expect(() => LoggerFactory.getLogger('consoleLOG , INVALID , File,SILENT')).throw('Unknown LogType INVALID');
    });
});
