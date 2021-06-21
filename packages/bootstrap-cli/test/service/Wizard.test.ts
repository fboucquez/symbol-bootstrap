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
import { BootstrapUtils, CustomPreset, LoggerFactory, LogType, Preset, PrivateKeySecurityMode, RewardProgram } from 'symbol-bootstrap-core';
import { Account, NetworkType } from 'symbol-sdk';
import Wizard, { Network } from '../../src/commands/wizard';
const logger = LoggerFactory.getLogger(LogType.ConsoleLog);
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
            'myhostname\n',
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
                    host: 'myhostname',
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
            'myhostname\n',
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
                    host: 'myhostname',
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
});
