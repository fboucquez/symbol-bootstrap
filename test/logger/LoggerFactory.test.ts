import { expect } from 'chai';
import { it } from 'mocha';
import { LoggerFactory } from '../../src';

describe('LoggerFactory', () => {
    it('BootstrapUtils getLogger file', async () => {
        const logger = LoggerFactory.getLogger('FiLe');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0]._basename).equals('logs.log');
        expect(transports[0].name).equals('file');
    });

    it('BootstrapUtils getLogger console', async () => {
        const logger = LoggerFactory.getLogger('console');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].name).equals('console');
    });

    it('BootstrapUtils getLogger console log', async () => {
        const logger = LoggerFactory.getLogger('consoleLOG');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].name).equals('console');
    });
    it('BootstrapUtils getLogger silent', async () => {
        const logger = LoggerFactory.getLogger('SILENT');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].silent).equals(true);
        expect(transports[0].name).equals('console');
    });
    it('BootstrapUtils getLogger multiple', async () => {
        const logger = LoggerFactory.getLogger('consoleLOG , , File,SILENT');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(3);
        expect(transports[0].name).equals('console');
        expect(transports[1].name).equals('file');
        expect(transports[1]._basename).equals('logs.log');
        expect(transports[2].name).equals('console');
        expect(transports[2].silent).equals(true);
    });
    it('BootstrapUtils getLogger invalid', async () => {
        expect(() => LoggerFactory.getLogger('consoleLOG , INVALID , File,SILENT')).throw('Unknown LogType INVALID');
    });
});
