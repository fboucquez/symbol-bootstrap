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

import { expect } from 'chai';
import { compareSync, Result } from 'dir-compare';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import 'mocha';
import { join } from 'path';
import { Account, Address, Convert, KeyPair, NetworkType } from 'symbol-sdk';
import {
    Assembly,
    BootstrapService,
    BootstrapUtils,
    ConfigLoader,
    ConfigParams,
    ConfigResult,
    CustomPreset,
    DefaultAccountResolver,
    LoggerFactory,
    LogType,
    Preset,
    PrivateKeySecurityMode,
    RewardProgram,
    VotingKeyFile,
    VotingKeyFileProvider,
    VotingKeyParams,
    VotingUtils,
    ZipUtils,
} from '../../src';

const toKey = (prefix: string, keySize = 64): string => {
    return prefix.padStart(keySize, '0');
};

const toPublicKey = (prefix: string, keySize = 64): string => {
    return Convert.uint8ToHex(KeyPair.createKeyPairFromPrivateKeyString(prefix.padStart(keySize, '0')).publicKey);
};

const logger = LoggerFactory.getLogger(LogType.Silence);
/**
 * Not random voting key provider.
 */
export class UnitTestVotingKeyFileProvider implements VotingKeyFileProvider {
    public async createVotingFile({
        presetData,
        nodePreset,
        votingKeysFolder,
        privateKeyTreeFileName,
        votingKeyStartEpoch,
        votingKeyEndEpoch,
    }: VotingKeyParams): Promise<VotingKeyFile> {
        const privateKeySuffix = Convert.utf8ToHex(nodePreset.name);
        const secret = toKey(privateKeySuffix);
        const votingAccount = Account.createFromPrivateKey(secret, presetData.networkType);
        const votingPrivateKey = votingAccount.privateKey;
        const votingUtils = new VotingUtils();
        const unitTestPrivateKeys: Uint8Array[] = [];
        for (let i = votingKeyStartEpoch; i < votingKeyEndEpoch + 1; i++) {
            unitTestPrivateKeys.push(Convert.hexToUint8(toKey(i + privateKeySuffix)));
        }
        const votingFile = await votingUtils.createVotingFile(
            votingPrivateKey,
            votingKeyStartEpoch,
            votingKeyEndEpoch,
            unitTestPrivateKeys,
        );
        writeFileSync(join(votingKeysFolder, privateKeyTreeFileName), votingFile);
        return {
            publicKey: votingAccount.publicKey,
            startEpoch: votingKeyStartEpoch,
            endEpoch: votingKeyEndEpoch,
            filename: privateKeyTreeFileName,
        };
    }
}

const customPreset: CustomPreset = {
    privateKeySecurityMode: PrivateKeySecurityMode.PROMPT_MAIN,
    maxUnlockedAccounts: 20,
    peersP2PListLimit: 10000,
    peersApiListLimit: 10000,
    restDeploymentToolVersion: '1.0.8',
    restDeploymentToolLastUpdatedDate: '2021-07-05',
    nodes: [
        {
            mainPrivateKey: '{{$index}}' + toKey('AAAAA1', 63),
            transportPrivateKey: '{{$index}}' + toKey('AAAAA2', 63),
            remotePrivateKey: '{{$index}}' + toKey('AAAAA3', 63),
            vrfPrivateKey: '{{$index}}' + toKey('AAAAA4', 63),
            agentPrivateKey: '{{$index}}' + toKey('AAAAA5', 63),
        },
    ],
};

const multinodeCustomPreset: CustomPreset = {
    nodes: [
        {
            mainPrivateKey: '{{$index}}' + toKey('AAAAA1', 63),
            transportPrivateKey: '{{$index}}' + toKey('AAAAA2', 63),
            remotePrivateKey: '{{$index}}' + toKey('AAAAA3', 63),
            vrfPrivateKey: '{{$index}}' + toKey('AAAAA4', 63),
            agentPrivateKey: '{{$index}}' + toKey('AAAAA5', 63),
        },
        {
            mainPrivateKey: '{{$index}}' + toKey('BBBBB1', 63),
            transportPrivateKey: '{{$index}}' + toKey('BBBBB2', 63),
            remotePrivateKey: '{{$index}}' + toKey('BBBBB3', 63),
            vrfPrivateKey: '{{$index}}' + toKey('BBBBB4', 63),
            agentPrivateKey: '{{$index}}' + toKey('BBBBB5', 63),
        },
    ],
};

const newNetworkType = NetworkType.PRIVATE_TEST;
const bootstrapCustomPreset: CustomPreset = {
    networkType: newNetworkType,
    nemesis: {
        nemesisSignerPrivateKey: toKey('AAAA'),
        mosaics: [
            {
                accounts: [toPublicKey('A1'), toPublicKey('A2'), toPublicKey('A3')],
            },
            {
                accounts: [toPublicKey('B1'), toPublicKey('B2'), toPublicKey('B3')],
            },
        ],
    },
    sinkAddress: Address.createFromPublicKey(toKey('BBB'), newNetworkType).plain(),
    nemesisGenerationHashSeed: toKey('CCC'),
};

const singleCurrencyCustomPreset: CustomPreset = {
    networkType: newNetworkType,
    nemesis: {
        nemesisSignerPrivateKey: toKey('AAAA'),
        mosaics: [
            {
                accounts: [toPublicKey('A1'), toPublicKey('A2'), toPublicKey('A3')],
            },
        ],
    },
    sinkAddress: Address.createFromPublicKey(toKey('BBB'), newNetworkType).plain(),
    nemesisGenerationHashSeed: toKey('CCC'),
};

describe('BootstrapService config', () => {
    const unzipTarget = `target/expectedTargets`;
    const patch = false;
    const zipUtils = new ZipUtils(logger);
    before(async () => {
        BootstrapUtils.deleteFolder(logger, unzipTarget);
        await zipUtils.unzip('test/expectedTargets.zip', 'expectedTargets', unzipTarget);
    });
    after(async () => {
        await zipUtils.zip('target/expectedTargets.zip', [
            {
                from: 'target/expectedTargets',
                to: 'expectedTargets',
                directory: true,
            },
        ]);
        await zipUtils.zip('target/target.zip', [
            {
                from: 'target/target',
                to: 'expectedTargets',
                directory: true,
            },
        ]);
        // NOTE: if tests has failed, compare test/targets.zip and target/expectedTargets.zip with intellij for example.
        // If you are happy and the changes are expected (a valid configuration change) replace and commit the new target/expectedTargets.zip into test/expectedTargets.zip
    });
    const presets = Object.values(Preset);
    const assemblies = Object.values(Assembly);

    async function basicConfigTest(preset: string, assembly: string, constPresetObject: CustomPreset, targetFolderName: string) {
        const service = new BootstrapService(logger);
        const target = `target/targets/${targetFolderName}`;
        const expectedTarget = join(unzipTarget, targetFolderName);
        const config: ConfigParams = {
            preset: preset,
            assembly: assembly,
            report: true,
            reset: true,
            offline: true,
            upgrade: false,
            target: target,
            workingDir: BootstrapUtils.defaultWorkingDir,
            version: '1.0.8',
            customPresetObject: constPresetObject,
            votingKeyFileProvider: new UnitTestVotingKeyFileProvider(),
            accountResolver: new DefaultAccountResolver(),
            user: BootstrapUtils.CURRENT_USER,
        };

        async function runConfig(description: string, configRunner: () => Promise<ConfigResult>) {
            console.log(`Running '${description}'`);

            const configResult = await configRunner();
            const dockerCompose = await service.compose({ ...config, upgrade: true, user: '1000:1000' });
            expect(configResult.presetData).to.not.null;
            expect(dockerCompose).to.not.undefined;
            if (!existsSync(expectedTarget)) {
                await BootstrapUtils.generateConfiguration({}, target, expectedTarget);
            }
            const compareResult: Result = compareSync(target, expectedTarget, {
                compareSize: true,
                compareContent: true,
                skipEmptyDirs: true,
                excludeFilter: '*.pem',
            });
            const differences = compareResult.diffSet?.filter((s) => s.state != 'equal') || [];
            const report = BootstrapUtils.toYaml(differences);

            const differentContents = differences
                .filter(
                    (d) =>
                        d.state == 'distinct' &&
                        (d.reason == 'different-content' || d.reason == 'different-size') &&
                        d.type1 == 'file' &&
                        d.type2 == 'file' &&
                        d.path1 &&
                        d.path2,
                )
                .filter((d) => {
                    const path1 = join(d.path1!, d.name1!);
                    const path2 = join(d.path2!, d.name2!);

                    if (patch) {
                        copyFileSync(path1, path2);
                    }
                    return !path1.endsWith('.dat') && !path1.endsWith('.proof');
                })
                .map((d) => {
                    console.log(d);
                    const path1 = join(d.path1!, d.name1!);
                    const path2 = join(d.path2!, d.name2!);

                    const content1 = readFileSync(path1, { encoding: 'utf-8' });
                    const content2 = readFileSync(path2, { encoding: 'utf-8' });
                    return { ...d, content1, content2 };
                });

            if (differentContents.length) {
                const diff = differentContents.reduce(
                    (r, d) => {
                        return {
                            content1: `${r.content1}${join(d.path1!, d.name1!)}\n\n${d.content1}\n\n\n`,
                            content2: `${r.content2}${join(d.path2!, d.name2!)}\n\n${d.content2}\n\n\n`,
                        };
                    },
                    {
                        content1: '',
                        content2: '',
                    },
                );
                expect(diff.content1, `there are differences between folders!. Report:\n\n${report}`).equals(diff.content2);
            } else {
                expect(compareResult.differences, `there are differences between folders!. Report:\n\n${report}`).equals(0);
            }
        }
        await runConfig('reset', () => service.config({ ...config, upgrade: true, reset: true }));
        await runConfig('upgrade', () => service.config({ ...config, upgrade: true, reset: false }));
        await runConfig('upgrade no params', () =>
            service.config({
                report: true,
                offline: true,
                target: target,
                user: BootstrapUtils.CURRENT_USER,
                workingDir: BootstrapUtils.defaultWorkingDir,
                version: '1.0.8',
                upgrade: true,
                reset: false,
                accountResolver: new DefaultAccountResolver(),
            }),
        );
    }
    const loader = new ConfigLoader(logger);
    for (const preset of presets) {
        for (const assembly of assemblies) {
            const targetFolderName = `${preset}-${assembly}-target`;
            it(`${targetFolderName} test`, () => {
                return basicConfigTest(
                    preset,
                    assembly,
                    loader.mergePresets(
                        customPreset,
                        assembly == Assembly.multinode ? multinodeCustomPreset : undefined,
                        preset == Preset.dualCurrency
                            ? bootstrapCustomPreset
                            : preset == Preset.singleCurrency
                            ? singleCurrencyCustomPreset
                            : undefined,
                    ),
                    targetFolderName,
                );
            });
        }
    }

    for (const preset of [Preset.mainnet, Preset.testnet]) {
        for (const assembly of [Assembly.peer, Assembly.dual, Assembly.demo, Assembly.demo]) {
            const targetFolderName = `${preset}-${assembly}-voting-target`;
            it(`${targetFolderName} test`, () => {
                return basicConfigTest(
                    preset,
                    assembly,
                    loader.mergePresets(customPreset, {
                        nodes: [
                            {
                                friendlyName: 'myRegularNode',
                                host: 'myRegularNode.host.com',
                                voting: true,
                            },
                        ],
                    }),
                    targetFolderName,
                );
            });
        }
    }
    for (const preset of [Preset.testnet]) {
        for (const assembly of [Assembly.dual]) {
            const targetFolderName = `${preset}-${assembly}-encrypt-target`;
            it(`${targetFolderName} test`, () => {
                return basicConfigTest(
                    preset,
                    assembly,
                    loader.mergePresets(customPreset, {
                        privateKeySecurityMode: PrivateKeySecurityMode.ENCRYPT,
                        nodes: [
                            {
                                friendlyName: 'myRegularNode',
                                host: 'myRegularNode.host.com',
                            },
                        ],
                    }),
                    targetFolderName,
                );
            });
        }
    }

    for (const preset of [Preset.testnet]) {
        for (const assembly of [Assembly.dual]) {
            const targetFolderName = `${preset}-${assembly}-native-ssl-target`;
            it(`${targetFolderName} test`, () => {
                return basicConfigTest(
                    preset,
                    assembly,
                    loader.mergePresets(customPreset, {
                        privateKeySecurityMode: PrivateKeySecurityMode.ENCRYPT,
                        nodes: [
                            {
                                friendlyName: 'myRegularNode',
                                host: 'myRegularNode.host.com',
                            },
                        ],
                        gateways: [
                            {
                                restProtocol: 'HTTPS',
                                openPort: 3001,
                                restSSLCertificateBase64:
                                    'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNFakNDQVhzQ0FnMzZNQTBHQ1NxR1NJYjNEUUVCQlFVQU1JR2JNUXN3Q1FZRFZRUUdFd0pLVURFT01Bd0cKQTFVRUNCTUZWRzlyZVc4eEVEQU9CZ05WQkFjVEIwTm9kVzh0YTNVeEVUQVBCZ05WQkFvVENFWnlZVzVyTkVSRQpNUmd3RmdZRFZRUUxFdzlYWldKRFpYSjBJRk4xY0hCdmNuUXhHREFXQmdOVkJBTVREMFp5WVc1ck5FUkVJRmRsCllpQkRRVEVqTUNFR0NTcUdTSWIzRFFFSkFSWVVjM1Z3Y0c5eWRFQm1jbUZ1YXpSa1pDNWpiMjB3SGhjTk1USXcKT0RJeU1EVXlOalUwV2hjTk1UY3dPREl4TURVeU5qVTBXakJLTVFzd0NRWURWUVFHRXdKS1VERU9NQXdHQTFVRQpDQXdGVkc5cmVXOHhFVEFQQmdOVkJBb01DRVp5WVc1ck5FUkVNUmd3RmdZRFZRUUREQTkzZDNjdVpYaGhiWEJzClpTNWpiMjB3WERBTkJna3Foa2lHOXcwQkFRRUZBQU5MQURCSUFrRUFtL3hta0htRVFydXJFLzByZS9qZUZSTGwKOFpQakJvcDd1TEhobmlhN2xRRy81ekR0WklVQzNSVnBxRFN3QnV3L05Ud2VHeXVQK284QUc5OEh4cXhUQndJRApBUUFCTUEwR0NTcUdTSWIzRFFFQkJRVUFBNEdCQUJTMlRMdUJlVFBtY2FUYVVXL0xDQjJOWU95OEdNZHpSMW14CjhpQkl1Mkg2L0UydGlZM1JJZXZWMk9XNjFxWTIvWFJRZzdZUHh4M2ZmZVV1Z1g5RjRKL2lQbm51MXpBeHh5QnkKMlZndUt2NFNXalJGb1JrSWZJbEhYMHFWdmlNaFNsTnkyaW9GTHk3SmNQWmIrdjNmdERHeXdVcWNCaVZEb2VhMApIbitHbXhaQQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg',
                                restSSLKeyBase64:
                                    'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlCT3dJQkFBSkJBSnY4WnBCNWhFSzdxeFA5SzN2NDNoVVM1ZkdUNHdhS2U3aXg0WjRtdTVVQnYrY3c3V1NGCkF0MFZhYWcwc0Fic1B6VThIaHNyai9xUEFCdmZCOGFzVXdjQ0F3RUFBUUpBRzByM2V6SDM1V0ZHMXRHR2FVT3IKUUE2MWN5YUlJNTNaZGdDUjFJVThieDdBVWV2bWtGdEJmK2FxTVd1c1dWT1dKdkd1MnI1VnBIVkFJbDhuRjZEUwprUUloQU1qRUozelZZYTIvTW80ZXkraVU5SjlWZCtXb3lYRFFENEVFdHdteUcxUHBBaUVBeHVabHZoREliYmNlCjdvNUJ2T2huQ1oyTjdrWWIxWkM1N2czRitjYkp5VzhDSVFDYnNER0hCdG8ycUp5RnhiQU83dVE4WTBVVkhhMEoKQk8vZzkwMFNBY0piY1FJZ1J0RWxqSVNoT0I4cERqcnNRUHhtSTFCTGhuakQxRWhSU3Vid2hEdzVBRlVDSVFDTgpBMjRwRHRkT0h5ZHd0U0I1K3pGcUZMZm1WWnBsUU0vZzVrYjRzbzcwWXc9PQotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo',
                            },
                        ],
                    }),
                    targetFolderName,
                );
            });
        }
    }

    for (const preset of [Preset.testnet]) {
        for (const assembly of [Assembly.dual]) {
            const targetFolderName = `${preset}-${assembly}-https-proxy-target`;
            it(`${targetFolderName} test`, () => {
                return basicConfigTest(
                    preset,
                    assembly,
                    loader.mergePresets(customPreset, {
                        privateKeySecurityMode: PrivateKeySecurityMode.ENCRYPT,
                        nodes: [
                            {
                                friendlyName: 'myRegularNode',
                                host: 'myRegularNode.host.com',
                            },
                        ],
                        httpsProxies: [{ excludeDockerService: false }],
                    }),
                    targetFolderName,
                );
            });
        }
    }

    for (const preset of [Preset.mainnet, Preset.testnet]) {
        for (const assembly of [Assembly.dual]) {
            const targetFolderName = `${preset}-${assembly}-supernode-target`;
            it(`${targetFolderName} test`, () => {
                return basicConfigTest(
                    preset,
                    assembly,
                    loader.mergePresets(customPreset, {
                        nodes: [
                            {
                                friendlyName: 'mySupernode',
                                host: 'mySupernode.host.com',
                                voting: true,
                                rewardProgram: RewardProgram.SuperNode,
                            },
                        ],
                    }),
                    targetFolderName,
                );
            });
        }
    }

    for (const preset of ['test/unit-test-profiles/custom-network.yml']) {
        for (const assembly of [Assembly.dual, Assembly.multinode]) {
            const targetFolderName = `custom-network-${assembly}-target`;
            it(`${targetFolderName} test`, () => {
                return basicConfigTest(
                    preset,
                    assembly,
                    loader.mergePresets(
                        customPreset,
                        assembly == Assembly.multinode ? multinodeCustomPreset : undefined,
                        bootstrapCustomPreset,
                    ),
                    targetFolderName,
                );
            });
        }
    }
});
