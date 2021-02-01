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

import { expect } from '@oclif/test';
import 'mocha';
import { AccountInfoDTO } from 'symbol-openapi-typescript-fetch-client';
import { AccountHttp, AccountInfo, Deadline, LinkAction, NodeKeyLinkTransaction, Transaction, TransactionType, UInt64 } from 'symbol-sdk';
import { BootstrapService, ConfigService, LinkService, LinkServiceTransactionFactoryParams, Preset } from '../../src/service';

const password = '1234';
describe('LinkService', () => {
    const alreadyLinkedAccountInfoDto: AccountInfoDTO = {
        account: {
            version: 1,
            address: '98FDAF58576716949328890D535F82C2C7A740F8902A9CED',
            addressHeight: '1',
            publicKey: 'A8443EE1BE131A300D321BAF116E18F6A339BB2FF16C02ED0C4D6C1EB71A648B',
            publicKeyHeight: '1',
            accountType: 1,
            supplementalPublicKeys: {
                linked: {
                    publicKey: '09DA71927DCBB67FD0352CFC16114BE51B87538E0AA8FC64233439E3DBAC87FB',
                },
                node: {
                    publicKey: '5B267BA8A425FB2AE0AD3A4B87D5342A4A5DF938BEEA96E4E437BF12ED9A7C09',
                },
                vrf: {
                    publicKey: 'AEC02D888F268EBDAD038E19BF2EE182E36F207F29BF05ABFC5E20EAF2D4F719',
                },
                voting: {
                    publicKeys: [
                        {
                            publicKey: '01D1CEDA3255CC8FD4E76AA32CDB8C31FA6F2CF752778DBF6E1BAE8F10472DF3',
                            startEpoch: 1,
                            endEpoch: 26280,
                        },
                    ],
                },
            },
            activityBuckets: [],
            mosaics: [],
            importance: '3000000',
            importanceHeight: '180',
        },
        id: '60168F146AE03A2FE7139F9B',
    };

    const alreadyLinkedAccountInfo: AccountInfo = (AccountHttp as any)['toAccountInfo'](alreadyLinkedAccountInfoDto);

    const notLinkedAccountDto: AccountInfoDTO = {
        account: {
            version: 1,
            address: '98FDAF58576716949328890D535F82C2C7A740F8902A9CED',
            addressHeight: '1',
            publicKey: 'A8443EE1BE131A300D321BAF116E18F6A339BB2FF16C02ED0C4D6C1EB71A648B',
            publicKeyHeight: '1',
            accountType: 1,
            supplementalPublicKeys: {},
            activityBuckets: [],
            mosaics: [],
            importance: '3000000',
            importanceHeight: '180',
        },
        id: '60168F146AE03A2FE7139F9B',
    };

    const notLinkedAcccountInfo: AccountInfo = (AccountHttp as any)['toAccountInfo'](notLinkedAccountDto);

    const assertTransaction = (transaction: Transaction, type: TransactionType, action: LinkAction, linkedPublicKey: string): void => {
        expect(transaction.type).eq(type);
        expect((transaction as NodeKeyLinkTransaction).linkAction).eq(action);
        expect((transaction as NodeKeyLinkTransaction).linkedPublicKey).eq(linkedPublicKey);
    };

    it('LinkService testnet when down', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual',
            password,
            reset: false,
            preset: Preset.testnet,
            assembly: 'dual',

            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
        };
        try {
            await new BootstrapService('.').config(params);
            await new BootstrapService('.').link(params);
        } catch (e) {
            expect(e.message.indexOf('ECONNREFUSED'), `Not a connection error: ${e.message}`).to.be.greaterThan(-1);
        }
    });

    it('LinkService create transactions when dual + voting', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual-voting',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/voting_preset.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: notLinkedAcccountInfo,
            removeOldLinked: true,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(4);
        assertTransaction(transactions[0], TransactionType.ACCOUNT_KEY_LINK, LinkAction.Link, nodeAccount.remote!.publicKey);
        assertTransaction(transactions[1], TransactionType.NODE_KEY_LINK, LinkAction.Link, nodeAccount.transport!.publicKey);
        assertTransaction(transactions[2], TransactionType.VRF_KEY_LINK, LinkAction.Link, nodeAccount.vrf!.publicKey);
        assertTransaction(transactions[3], TransactionType.VOTING_KEY_LINK, LinkAction.Link, nodeAccount.voting!.publicKey);
    });

    it('LinkService create transactions when dual + voting and already linked', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual-voting',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/voting_preset.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: alreadyLinkedAccountInfo,
            removeOldLinked: true,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(7);

        assertTransaction(
            transactions[0],
            TransactionType.ACCOUNT_KEY_LINK,
            LinkAction.Unlink,
            alreadyLinkedAccountInfo.supplementalPublicKeys.linked!.publicKey,
        );
        assertTransaction(transactions[1], TransactionType.ACCOUNT_KEY_LINK, LinkAction.Link, nodeAccount.remote!.publicKey);

        assertTransaction(
            transactions[2],
            TransactionType.NODE_KEY_LINK,
            LinkAction.Unlink,
            alreadyLinkedAccountInfo.supplementalPublicKeys.node!.publicKey,
        );
        assertTransaction(transactions[3], TransactionType.NODE_KEY_LINK, LinkAction.Link, nodeAccount.transport!.publicKey);

        assertTransaction(
            transactions[4],
            TransactionType.VRF_KEY_LINK,
            LinkAction.Unlink,
            alreadyLinkedAccountInfo.supplementalPublicKeys.vrf!.publicKey,
        );
        assertTransaction(transactions[5], TransactionType.VRF_KEY_LINK, LinkAction.Link, nodeAccount.vrf!.publicKey);

        assertTransaction(transactions[6], TransactionType.VOTING_KEY_LINK, LinkAction.Link, nodeAccount.voting!.publicKey);
    });

    it('LinkService create transactions when dual + voting and already linked not removed', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual-voting',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/voting_preset.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: alreadyLinkedAccountInfo,
            removeOldLinked: false,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(1);

        assertTransaction(transactions[0], TransactionType.VOTING_KEY_LINK, LinkAction.Link, nodeAccount.voting!.publicKey);
    });

    it('LinkService create transactions when dual', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual',
            password,
            reset: true,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: notLinkedAcccountInfo,
            removeOldLinked: true,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(3);
        assertTransaction(transactions[0], TransactionType.ACCOUNT_KEY_LINK, LinkAction.Link, nodeAccount.remote!.publicKey);
        assertTransaction(transactions[1], TransactionType.NODE_KEY_LINK, LinkAction.Link, nodeAccount.transport!.publicKey);
        assertTransaction(transactions[2], TransactionType.VRF_KEY_LINK, LinkAction.Link, nodeAccount.vrf!.publicKey);
    });

    it('LinkService create transactions when dual already linked', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual',
            password,
            reset: true,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: alreadyLinkedAccountInfo,
            removeOldLinked: true,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(6);
        assertTransaction(
            transactions[0],
            TransactionType.ACCOUNT_KEY_LINK,
            LinkAction.Unlink,
            alreadyLinkedAccountInfo.supplementalPublicKeys.linked!.publicKey,
        );
        assertTransaction(transactions[1], TransactionType.ACCOUNT_KEY_LINK, LinkAction.Link, nodeAccount.remote!.publicKey);

        assertTransaction(
            transactions[2],
            TransactionType.NODE_KEY_LINK,
            LinkAction.Unlink,
            alreadyLinkedAccountInfo.supplementalPublicKeys.node!.publicKey,
        );
        assertTransaction(transactions[3], TransactionType.NODE_KEY_LINK, LinkAction.Link, nodeAccount.transport!.publicKey);

        assertTransaction(
            transactions[4],
            TransactionType.VRF_KEY_LINK,
            LinkAction.Unlink,
            alreadyLinkedAccountInfo.supplementalPublicKeys.vrf!.publicKey,
        );
        assertTransaction(transactions[5], TransactionType.VRF_KEY_LINK, LinkAction.Link, nodeAccount.vrf!.publicKey);
    });

    it('LinkService create transactions when dual already linked not removing', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual',
            password,
            reset: true,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'dual',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: alreadyLinkedAccountInfo,
            removeOldLinked: false,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(0);
    });

    it('LinkService create transactions when dual not using remote account', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-dual-not-remote',
            password,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: false,
            },
            assembly: 'dual',
        };

        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: notLinkedAcccountInfo,
            removeOldLinked: true,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(1);
        assertTransaction(transactions[0], TransactionType.VRF_KEY_LINK, LinkAction.Link, nodeAccount.vrf!.publicKey);
    });

    it('LinkService create transactions when api', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-api',
            password,
            reset: false,
            preset: Preset.testnet,
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'api',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: addresses.nodes![0],
            maxFee: maxFee,
            mainAccountInfo: notLinkedAcccountInfo,
            removeOldLinked: true,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(0);
    });

    it('LinkService create transactions when api and voting', async () => {
        const params = {
            ...ConfigService.defaultParams,
            ...LinkService.defaultParams,
            target: 'target/tests/testnet-api-voting',
            password,
            reset: false,
            preset: Preset.testnet,
            customPreset: './test/voting_preset.yml',
            customPresetObject: {
                nodeUseRemoteAccount: true,
            },
            assembly: 'api',
        };
        const { addresses, presetData } = await new BootstrapService('.').config(params);
        const maxFee = UInt64.fromUint(10);
        const nodeAccount = addresses.nodes![0];
        const transactionFactoryParams: LinkServiceTransactionFactoryParams = {
            presetData,
            deadline: Deadline.create(1),
            nodeAccount: nodeAccount,
            maxFee: maxFee,
            mainAccountInfo: notLinkedAcccountInfo,
            removeOldLinked: true,
        };

        const transactions = await new LinkService(params).createTransactions(transactionFactoryParams);
        expect(transactions.length).eq(3);
        assertTransaction(transactions[0], TransactionType.ACCOUNT_KEY_LINK, LinkAction.Link, nodeAccount.remote!.publicKey);
        assertTransaction(transactions[1], TransactionType.NODE_KEY_LINK, LinkAction.Link, nodeAccount.transport!.publicKey);
        assertTransaction(transactions[2], TransactionType.VOTING_KEY_LINK, LinkAction.Link, nodeAccount.voting!.publicKey);
    });
});
