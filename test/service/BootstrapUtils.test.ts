import 'mocha';
import { BootstrapUtils, Preset } from '../../src/service';
import assert = require('assert');
import { expect } from '@oclif/test';
import { Convert, Crypto } from 'symbol-sdk';

describe('BootstrapUtils', () => {
    it('BootstrapUtils dockerUserId', async () => {
        const user1 = await BootstrapUtils.getDockerUserGroup();
        const user2 = await BootstrapUtils.getDockerUserGroup();
        const user3 = await BootstrapUtils.getDockerUserGroup();
        assert.strictEqual(user1, user2);
        assert.strictEqual(user1, user3);
    });

    it('BootstrapUtils loadPresetData testnet no assembly', async () => {
        try {
            await BootstrapUtils.loadPresetData('.', Preset.testnet, undefined, undefined, undefined);
        } catch (e) {
            expect(e.message).to.equal('Preset testnet requires assembly (-a, --assembly option). Possible values are: api, dual, peer');
            return;
        }
        expect(true).to.be.false;
    });

    it('BootstrapUtils loadPresetData testnet assembly', async () => {
        const presetData = await BootstrapUtils.loadPresetData('.', Preset.testnet, 'dual', undefined, undefined);
        expect(presetData).to.not.be.undefined;
    });

    it('BootstrapUtils loadPresetData bootstrap custom', async () => {
        const presetData = await BootstrapUtils.loadPresetData(
            '.',
            Preset.bootstrap,
            undefined,
            'test/override-currency-preset.yml',
            undefined,
        );
        expect(presetData).to.not.be.undefined;
        expect(presetData?.nemesis?.mosaics?.[0].accounts).to.be.eq(20);
        const yaml = BootstrapUtils.toYaml(presetData);
        expect(BootstrapUtils.fromYaml(yaml)).to.be.deep.eq(presetData);
    });

    it('BootstrapUtils.toAmount', async () => {
        expect(() => BootstrapUtils.toAmount(12345678.9)).to.throw;
        expect(() => BootstrapUtils.toAmount('12345678.9')).to.throw;
        expect(() => BootstrapUtils.toAmount('abc')).to.throw;
        expect(() => BootstrapUtils.toAmount('')).to.throw;
        expect(BootstrapUtils.toAmount(12345678)).to.be.eq("12'345'678");
        expect(BootstrapUtils.toAmount('12345678')).to.be.eq("12'345'678");
        expect(BootstrapUtils.toAmount("12'3456'78")).to.be.eq("12'345'678");
    });

    it('BootstrapUtils.toHex', async () => {
        expect(BootstrapUtils.toHex("5E62990DCAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(BootstrapUtils.toHex("0x5E62'990D'CAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(BootstrapUtils.toHex('0x5E62990DCAC5BE8A')).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(BootstrapUtils.toHex("5E62'990D'CAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
    });

    it('createVotingKey', async () => {
        expect(BootstrapUtils.createVotingKey('ABC')).to.be.eq(
            'ABC000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        );
        const votingKey = Convert.uint8ToHex(Crypto.randomBytes(48));
        expect(BootstrapUtils.createVotingKey(votingKey)).to.be.eq(votingKey);
    });
});
