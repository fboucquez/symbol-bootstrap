import { expect } from 'chai';
import { it } from 'mocha';
import { LoggerFactory, LogType, RuntimeService } from '../../src';
const logger = LoggerFactory.getLogger(LogType.Silent);
const service = new RuntimeService(logger);
describe('RuntimeService', async () => {
    it('exec when valid', async () => {
        const response = await service.exec('echo "ABC"');
        expect(response).deep.eq({
            stderr: '',
            stdout: 'ABC\n',
        });
    });

    it('exec when invalid', async () => {
        try {
            await service.exec('wrong!');
            expect(true).eq(false); //Should fail!!
        } catch (e) {
            expect(e.message.indexOf('wrong!')).not.eq(-1);
            expect(e.stderr.indexOf('wrong!')).not.eq(-1);
            expect(e.stdout).eq('');
            expect(e.cmd).eq('wrong!');
            expect(e.code).eq(127);
        }
    });

    it('spawn when valid', async () => {
        const response = await service.spawn('echo', ['ABC'], true);
        expect(response).eq('ABC\n');
    });

    it('exec when invalid', async () => {
        try {
            await service.exec('wrong!');
            expect(true).eq(false); //Should fail!!
        } catch (e) {
            expect(e.message.indexOf('wrong!')).not.eq(-1);
            expect(e.stderr.indexOf('wrong!')).not.eq(-1);
            expect(e.stdout).eq('');
            expect(e.cmd).eq('wrong!');
            expect(e.code).eq(127);
        }
    });

    it('spawn when invalid', async () => {
        try {
            await service.spawn('wrong!', [], false);
            expect(true).eq(false); //Should fail!!
        } catch (e) {
            expect(e.message).eq('Process closed with code -2\nCheck console for output....');
        }
    });

    it('getDockerUserGroup', async () => {
        const user1 = await service.getDockerUserGroup();
        const user2 = await service.getDockerUserGroup();
        const user3 = await service.getDockerUserGroup();
        expect(user1).eq(user2);
        expect(user1).eq(user3);
    });
});
