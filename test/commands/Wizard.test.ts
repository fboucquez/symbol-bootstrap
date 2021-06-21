/*
 * Copyright 2021 NEM
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

import { expect } from '@oclif/test';
import { stdin } from 'mock-stdin';
import { Account, NetworkType } from 'symbol-sdk';
import { BootstrapUtils, CustomPreset, LoggerFactory, LogType, Preset, PrivateKeySecurityMode, RewardProgram } from '../../src';
import Wizard, { Network } from '../../src/commands/wizard';
const logger = LoggerFactory.getLogger(LogType.Silence);
export const StdUtils = {
    keys: Object.freeze({
        up: '\u001b[A',
        down: '\u001b[B',
        left: '\u001b[D',
        right: '\u001b[C',
    }),
    in: (responses: string[]): void => {
        let k = 0;

        const s = stdin();
        function sendAnswer() {
            setTimeout(function () {
                const text = responses[k];
                s.send(text);
                k += 1;
                if (k < responses.length) {
                    sendAnswer();
                }
            }, 0);
        }

        sendAnswer();
    },
};

describe('Wizard', () => {
    const testFolder = 'target/wizardTest';
    beforeEach(async () => {
        BootstrapUtils.deleteFolder(logger, testFolder);
    });
    it('Provide private keys', async () => {
        // assembly
        StdUtils.in([
            '\n',
            '\n',
            StdUtils.keys.down,
            '\n',
            StdUtils.keys.down,
            '\n',
            'AAA3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1\n',
            'y\n',
            StdUtils.keys.down,
            '\n',
            'BBB3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1\n',
            'y\n',
            StdUtils.keys.down,
            '\n',
            'CCC3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1\n',
            'y\n',
            StdUtils.keys.down,
            '\n',
            'DDD3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1\n',
            'y\n',
            StdUtils.keys.down,
            '\n',
            'EEE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1\n',
            'y\n',
            StdUtils.keys.down, // resolveHttpsOptions select none down 1/2
            StdUtils.keys.down, // resolveHttpsOptions select none down 2/2
            '\n',
            'myhostname.org\n',
            'myfriendlyname\n',
            '\n',
            'y\n', //Voting!
            '\n',
            'n\n',
            'n\n',
        ]);

        const password = '11111';
        const customPresetFile = `${testFolder}/wizard-custom.yml`;
        await Wizard.execute(BootstrapUtils.resolveRootFolder(), {
            customPreset: customPresetFile,
            network: Network.mainnet,
            noPassword: false,
            skipPull: true,
            target: `${testFolder}/target`,
            password: password,
        });
        const expectedCustomPreset: CustomPreset = {
            assembly: 'dual',
            nodes: [
                {
                    friendlyName: 'myfriendlyname',
                    host: 'myhostname.org',
                    voting: true,
                    mainPrivateKey: 'AAA3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
                    remotePrivateKey: 'DDD3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
                    transportPrivateKey: 'BBB3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
                    vrfPrivateKey: 'CCC3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
                    agentPrivateKey: 'EEE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1',
                    rewardProgram: RewardProgram.SuperNode,
                },
            ],
            preset: Preset.mainnet,
            privateKeySecurityMode: PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
        };
        const customPreset = BootstrapUtils.loadYaml(customPresetFile, password);
        expect(customPreset).deep.eq(expectedCustomPreset);
    });

    it('Generate private keys', async () => {
        const toKey = (prefix: string | number, keySize = 64): string => {
            return prefix.toString().padStart(keySize, '0');
        };
        let index = 0;
        Wizard.generateAccount = (networkType: NetworkType) => {
            return Account.createFromPrivateKey(toKey(++index), networkType);
        };
        // assembly
        StdUtils.in([
            '\n',
            'y\n', //Are you offline.
            '\n',
            '\n',
            '\n',
            '\n',
            '\n',
            StdUtils.keys.down, // resolveHttpsOptions select none down 1
            StdUtils.keys.down, // resolveHttpsOptions select none down 2
            '\n',
            'myhostname.org\n',
            'myfriendlyname\n',
            '\n',
            'y\n',
            // '\n',
            // '\n',
            // 'y\n',
        ]);

        const customPresetFile = `${testFolder}/wizard-custom.yml`;
        const password = '11111';
        await Wizard.execute(BootstrapUtils.resolveRootFolder(), {
            customPreset: customPresetFile,
            network: Network.mainnet,
            noPassword: false,
            skipPull: true,
            target: `${testFolder}/target`,
            password: password,
        });
        const expectedCustomPreset: CustomPreset = {
            assembly: 'dual',
            nodes: [
                {
                    friendlyName: 'myfriendlyname',
                    host: 'myhostname.org',
                    mainPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
                    remotePrivateKey: '0000000000000000000000000000000000000000000000000000000000000004',
                    transportPrivateKey: '0000000000000000000000000000000000000000000000000000000000000002',
                    voting: true,
                    vrfPrivateKey: '0000000000000000000000000000000000000000000000000000000000000003',
                },
            ],
            preset: Preset.mainnet,
            privateKeySecurityMode: PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
        };
        const customPreset = BootstrapUtils.loadYaml(customPresetFile, password);
        expect(customPreset).deep.eq(expectedCustomPreset);
    });

    it('Enables httpsProxy on rest-gateway', async () => {
        const toKey = (prefix: string | number, keySize = 64): string => {
            return prefix.toString().padStart(keySize, '0');
        };
        let index = 0;
        Wizard.generateAccount = (networkType: NetworkType) => {
            return Account.createFromPrivateKey(toKey(++index), networkType);
        };
        // assembly
        StdUtils.in([
            '\n',
            'y\n', //Are you offline.
            '\n',
            '\n',
            '\n',
            '\n',
            '\n',
            StdUtils.keys.down, // resolveHttpsOptions select Automatic
            '\n',
            'myhostname.org\n',
            'myfriendlyname\n',
            '\n',
            'y\n',
            // '\n',
            // '\n',
            // 'y\n',
        ]);

        const customPresetFile = `${testFolder}/wizard-custom.yml`;
        const password = '11111';
        await Wizard.execute(BootstrapUtils.resolveRootFolder(), {
            customPreset: customPresetFile,
            network: Network.mainnet,
            noPassword: false,
            skipPull: true,
            target: `${testFolder}/target`,
            password: password,
        });
        const expectedCustomPreset: CustomPreset = {
            preset: Preset.mainnet,
            assembly: 'dual',
            privateKeySecurityMode: PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
            nodes: [
                {
                    friendlyName: 'myfriendlyname',
                    host: 'myhostname.org',
                    mainPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
                    remotePrivateKey: '0000000000000000000000000000000000000000000000000000000000000004',
                    transportPrivateKey: '0000000000000000000000000000000000000000000000000000000000000002',
                    voting: true,
                    vrfPrivateKey: '0000000000000000000000000000000000000000000000000000000000000003',
                },
            ],
            httpsProxies: [
                {
                    excludeDockerService: false,
                },
            ],
        };
        console.log(BootstrapUtils.toYaml(expectedCustomPreset));
        const customPreset = BootstrapUtils.loadYaml(customPresetFile, password);
        expect(customPreset).deep.eq(expectedCustomPreset);
    });

    it('Enables native SSL support on rest-gateway', async () => {
        const toKey = (prefix: string | number, keySize = 64): string => {
            return prefix.toString().padStart(keySize, '0');
        };
        let index = 0;
        Wizard.generateAccount = (networkType: NetworkType) => {
            return Account.createFromPrivateKey(toKey(++index), networkType);
        };
        // assembly
        StdUtils.in([
            '\n',
            'y\n', //Are you offline.
            '\n',
            '\n',
            '\n',
            '\n',
            '\n',
            '\n', // resolveHttpsOptions select Native
            'myhostname.org\n',
            './test/certificates/restSsl.key\n',
            './test/certificates/restSsl.crt\n',
            'myfriendlyname\n',
            '\n',
            'y\n',
            // '\n',
            // '\n',
            // 'y\n',
        ]);

        const customPresetFile = `${testFolder}/wizard-custom.yml`;
        const password = '11111';
        await Wizard.execute(BootstrapUtils.resolveRootFolder(), {
            customPreset: customPresetFile,
            network: Network.mainnet,
            noPassword: false,
            skipPull: true,
            target: `${testFolder}/target`,
            password: password,
        });
        const expectedCustomPreset: CustomPreset = {
            preset: Preset.mainnet,
            assembly: 'dual',
            privateKeySecurityMode: PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
            nodes: [
                {
                    friendlyName: 'myfriendlyname',
                    host: 'myhostname.org',
                    mainPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
                    remotePrivateKey: '0000000000000000000000000000000000000000000000000000000000000004',
                    transportPrivateKey: '0000000000000000000000000000000000000000000000000000000000000002',
                    voting: true,
                    vrfPrivateKey: '0000000000000000000000000000000000000000000000000000000000000003',
                },
            ],
            gateways: [
                {
                    restProtocol: 'HTTPS',
                    openPort: 3001,
                    restSSLCertificateBase64:
                        'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNFakNDQVhzQ0FnMzZNQTBHQ1NxR1NJYjNEUUVCQlFVQU1JR2JNUXN3Q1FZRFZRUUdFd0pLVURFT01Bd0cKQTFVRUNCTUZWRzlyZVc4eEVEQU9CZ05WQkFjVEIwTm9kVzh0YTNVeEVUQVBCZ05WQkFvVENFWnlZVzVyTkVSRQpNUmd3RmdZRFZRUUxFdzlYWldKRFpYSjBJRk4xY0hCdmNuUXhHREFXQmdOVkJBTVREMFp5WVc1ck5FUkVJRmRsCllpQkRRVEVqTUNFR0NTcUdTSWIzRFFFSkFSWVVjM1Z3Y0c5eWRFQm1jbUZ1YXpSa1pDNWpiMjB3SGhjTk1USXcKT0RJeU1EVXlOalUwV2hjTk1UY3dPREl4TURVeU5qVTBXakJLTVFzd0NRWURWUVFHRXdKS1VERU9NQXdHQTFVRQpDQXdGVkc5cmVXOHhFVEFQQmdOVkJBb01DRVp5WVc1ck5FUkVNUmd3RmdZRFZRUUREQTkzZDNjdVpYaGhiWEJzClpTNWpiMjB3WERBTkJna3Foa2lHOXcwQkFRRUZBQU5MQURCSUFrRUFtL3hta0htRVFydXJFLzByZS9qZUZSTGwKOFpQakJvcDd1TEhobmlhN2xRRy81ekR0WklVQzNSVnBxRFN3QnV3L05Ud2VHeXVQK284QUc5OEh4cXhUQndJRApBUUFCTUEwR0NTcUdTSWIzRFFFQkJRVUFBNEdCQUJTMlRMdUJlVFBtY2FUYVVXL0xDQjJOWU95OEdNZHpSMW14CjhpQkl1Mkg2L0UydGlZM1JJZXZWMk9XNjFxWTIvWFJRZzdZUHh4M2ZmZVV1Z1g5RjRKL2lQbm51MXpBeHh5QnkKMlZndUt2NFNXalJGb1JrSWZJbEhYMHFWdmlNaFNsTnkyaW9GTHk3SmNQWmIrdjNmdERHeXdVcWNCaVZEb2VhMApIbitHbXhaQQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==',
                    restSSLKeyBase64:
                        'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlCT3dJQkFBSkJBSnY4WnBCNWhFSzdxeFA5SzN2NDNoVVM1ZkdUNHdhS2U3aXg0WjRtdTVVQnYrY3c3V1NGCkF0MFZhYWcwc0Fic1B6VThIaHNyai9xUEFCdmZCOGFzVXdjQ0F3RUFBUUpBRzByM2V6SDM1V0ZHMXRHR2FVT3IKUUE2MWN5YUlJNTNaZGdDUjFJVThieDdBVWV2bWtGdEJmK2FxTVd1c1dWT1dKdkd1MnI1VnBIVkFJbDhuRjZEUwprUUloQU1qRUozelZZYTIvTW80ZXkraVU5SjlWZCtXb3lYRFFENEVFdHdteUcxUHBBaUVBeHVabHZoREliYmNlCjdvNUJ2T2huQ1oyTjdrWWIxWkM1N2czRitjYkp5VzhDSVFDYnNER0hCdG8ycUp5RnhiQU83dVE4WTBVVkhhMEoKQk8vZzkwMFNBY0piY1FJZ1J0RWxqSVNoT0I4cERqcnNRUHhtSTFCTGhuakQxRWhSU3Vid2hEdzVBRlVDSVFDTgpBMjRwRHRkT0h5ZHd0U0I1K3pGcUZMZm1WWnBsUU0vZzVrYjRzbzcwWXc9PQotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo=',
                },
            ],
        };

        console.log(BootstrapUtils.toYaml(expectedCustomPreset));
        const customPreset = BootstrapUtils.loadYaml(customPresetFile, password);
        expect(customPreset).deep.eq(expectedCustomPreset);
    });

    describe('isValidHost', () => {
        // valid cases
        it('should return true when given hostname is a valid IP address', () => {
            expect(Wizard.isValidHost('10.10.10.10')).to.be.true;
        });

        it('should return true when given hostname is a valid domain name', () => {
            expect(Wizard.isValidHost('example.com')).to.be.true;
        });

        it('should return true when given hostname is a valid numeric only domain name', () => {
            expect(Wizard.isValidHost('1000.org')).to.be.true;
        });

        it('should return true when given hostname is a valid a subdomain', () => {
            expect(Wizard.isValidHost('mynode.example.com')).to.be.true;
        });

        it('should return true when given hostname is a valid a subdomain starting with number', () => {
            expect(Wizard.isValidHost('2.example.com')).to.be.true;
        });

        // invalid cases
        it('should return error when given hostname is an invalid IP address', () => {
            expect(Wizard.isValidHost('256.10.10.10')).to.be.eq("It's not a valid IP or hostname");
        });

        it('should return error when given hostname does not have an extension', () => {
            expect(Wizard.isValidHost('example')).to.be.eq("It's not a valid IP or hostname");
        });

        it('should return error when given hostname is an invalid domain name', () => {
            expect(Wizard.isValidHost('symbol-harvesting-.org')).to.be.eq("It's not a valid IP or hostname");
        });

        it('should return error when given hostname is an invalid a subdomain', () => {
            expect(Wizard.isValidHost('2-.example.com')).to.be.eq("It's not a valid IP or hostname");
        });
    });
});
