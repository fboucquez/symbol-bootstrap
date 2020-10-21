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

    it('applyIndex', async () => {
        const context = { $index: 10 };
        expect(BootstrapUtils.applyValueTemplate(context, 'hello')).to.be.eq('hello');
        expect(BootstrapUtils.applyValueTemplate(context, 'index')).to.be.eq('index');
        expect(BootstrapUtils.applyValueTemplate(context, '$index')).to.be.eq('$index');
        expect(BootstrapUtils.applyValueTemplate(context, '{{index}}')).to.be.eq('');
        expect(BootstrapUtils.applyValueTemplate(context, '{{$index}}')).to.be.eq('10');
        expect(BootstrapUtils.applyValueTemplate(context, '{{add $index 2}}')).to.be.eq('12');
        expect(BootstrapUtils.applyValueTemplate(context, '100.100.{{add $index 2}}')).to.be.eq('100.100.12');
        expect(BootstrapUtils.applyValueTemplate(context, '100.100.{{add $index 5}}')).to.be.eq('100.100.15');
    });

    it('expandServicesRepeat when repeat 3', async () => {
        const services = [
            {
                repeat: 3,
                apiNodeName: 'api-node-{{$index}}',
                apiNodeHost: 'api-node-{{$index}}',
                apiNodeBrokerHost: 'api-node-broker-{{$index}}',
                name: 'rest-gateway-{{$index}}',
                description: 'catapult development network',
                maxConnectionAttempts: 7,
                baseRetryDelay: 750,
                databaseHost: 'db-{{$index}}',
                openPort: true,
                ipv4_address: '172.20.0.{{add $index 5}}',
            },
        ];

        const expandedServices = BootstrapUtils.expandServicesRepeat({}, services);

        const expectedExpandedServices = [
            {
                apiNodeName: 'api-node-0',
                apiNodeHost: 'api-node-0',
                apiNodeBrokerHost: 'api-node-broker-0',
                name: 'rest-gateway-0',
                description: 'catapult development network',
                maxConnectionAttempts: 7,
                baseRetryDelay: 750,
                databaseHost: 'db-0',
                openPort: true,
                ipv4_address: '172.20.0.5',
            },
            {
                apiNodeName: 'api-node-1',
                apiNodeHost: 'api-node-1',
                apiNodeBrokerHost: 'api-node-broker-1',
                name: 'rest-gateway-1',
                description: 'catapult development network',
                maxConnectionAttempts: 7,
                baseRetryDelay: 750,
                databaseHost: 'db-1',
                openPort: true,
                ipv4_address: '172.20.0.6',
            },
            {
                apiNodeName: 'api-node-2',
                apiNodeHost: 'api-node-2',
                apiNodeBrokerHost: 'api-node-broker-2',
                name: 'rest-gateway-2',
                description: 'catapult development network',
                maxConnectionAttempts: 7,
                baseRetryDelay: 750,
                databaseHost: 'db-2',
                openPort: true,
                ipv4_address: '172.20.0.7',
            },
        ];
        expect(expandedServices).to.be.deep.eq(expectedExpandedServices);
    });

    it('expandServicesRepeat when repeat 0', async () => {
        const services = [
            {
                repeat: 0,
                apiNodeName: 'api-node-{{$index}}',
                apiNodeHost: 'api-node-{{$index}}',
                apiNodeBrokerHost: 'api-node-broker-{{$index}}',
                name: 'rest-gateway-{{$index}}',
                description: 'catapult development network',
                maxConnectionAttempts: 7,
                baseRetryDelay: 750,
                databaseHost: 'db-{{$index}}',
                openPort: true,
                ipv4_address: '172.20.0.{{add $index 5}}',
            },
        ];

        const expandedServices = BootstrapUtils.expandServicesRepeat({}, services);

        expect(expandedServices).to.be.deep.eq([]);
    });

    it('expandServicesRepeat when no repeat', async () => {
        const services = [
            {
                apiNodeName: 'api-node-{{$index}}',
                apiNodeHost: 'api-node-{{$index}}',
                apiNodeBrokerHost: 'api-node-broker-{{$index}}',
                name: 'rest-gateway-{{$index}}',
                description: 'catapult development network',
                maxConnectionAttempts: 7,
                baseRetryDelay: 750,
                databaseHost: 'db-{{$index}}',
                openPort: true,
                ipv4_address: '172.20.0.{{add $index 5}}',
            },
        ];

        const expandedServices = BootstrapUtils.expandServicesRepeat({}, services);

        const expectedExpandedServices = [
            {
                apiNodeName: 'api-node-{{$index}}',
                apiNodeHost: 'api-node-{{$index}}',
                apiNodeBrokerHost: 'api-node-broker-{{$index}}',
                name: 'rest-gateway-{{$index}}',
                description: 'catapult development network',
                maxConnectionAttempts: 7,
                baseRetryDelay: 750,
                databaseHost: 'db-{{$index}}',
                openPort: true,
                ipv4_address: '172.20.0.{{add $index 5}}',
            },
        ];
        expect(expandedServices).to.be.deep.eq(expectedExpandedServices);
    });

    it('applyValueTemplate when object', async () => {
        const value = {
            _info: 'this file contains a list of api-node peers',
            knownPeers: [
                {
                    publicKey: '46902d4a6136d43f8d78e3ab4494aee9b1da17886f6f0a698959714f96900bd6',
                    endpoint: {
                        host: 'api-node-0',
                        port: 7900,
                    },
                    metadata: {
                        name: 'api-node-0',
                        roles: 'Api',
                    },
                },
            ],
        };

        expect(BootstrapUtils.applyValueTemplate({}, value)).to.be.deep.eq(value);
        expect(BootstrapUtils.applyValueTemplate({}, BootstrapUtils.fromYaml(BootstrapUtils.toYaml(value)))).to.be.deep.eq(value);
    });

    it('applyValueTemplate when array', async () => {
        const value = [
            {
                _info: 'this file contains a list of api-node peers',
                knownPeers: [
                    {
                        publicKey: '46902d4a6136d43f8d78e3ab4494aee9b1da17886f6f0a698959714f96900bd6',
                        endpoint: {
                            host: 'api-node-0',
                            port: 7900,
                        },
                        metadata: {
                            name: 'api-node-0',
                            roles: 'Api',
                        },
                    },
                ],
            },
        ];

        expect(BootstrapUtils.applyValueTemplate({}, value)).to.be.deep.eq(value);
        expect(BootstrapUtils.applyValueTemplate({}, BootstrapUtils.fromYaml(BootstrapUtils.toYaml(value)))).to.be.deep.eq(value);
    });
});
