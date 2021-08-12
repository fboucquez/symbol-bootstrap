import { expect } from 'chai';
import { it } from 'mocha';
import { LoggerFactory, LogType, OSUtils, RuntimeService } from '../../src';
const logger = LoggerFactory.getLogger(LogType.Silent);
const service = new RuntimeService(logger);
describe('RuntimeService', async () => {
    it('exec when valid', async () => {
        const response = await service.exec('echo "ABC"');
        expect(response).deep.eq({
            stderr: '',
            stdout: OSUtils.isWindows() ? '"ABC"\r\n' : 'ABC\n',
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
            expect(e.code).eq(OSUtils.isWindows() ? 1 : 127);
        }
    });

    it('exec when invalid ignore error', async () => {
        const result = await service.exec('wrong!', true);
        expect(result.stderr.indexOf('wrong!')).not.eq(-1);
        expect(result.stdout).eq('');
    });

    it('spawn when valid', async () => {
        const response = await service.spawn({ command: 'echo', args: ['ABC'], useLogger: true, logPrefix: '', shell: true });
        expect(response).eq('ABC\n');
    });

    it('spawn when invalid', async () => {
        try {
            await service.spawn({ command: 'wrong!', args: [], useLogger: false, logPrefix: '', shell: true });
            expect(true).eq(false); //Should fail!!
        } catch (e) {
            const code = OSUtils.isWindows() ? 1 : 127;
            expect(e.message).eq(`Process exited with code ${code}\nCheck console for output....`);
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
