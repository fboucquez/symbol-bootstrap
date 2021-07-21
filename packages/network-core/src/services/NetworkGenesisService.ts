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
import { existsSync } from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import {
    Assembly,
    BootstrapService,
    BootstrapUtils,
    ConfigLoader,
    ConfigService,
    CryptoUtils,
    CustomPreset,
    KeyName,
    Logger,
    NemesisPreset,
    PeerInfo,
} from 'symbol-bootstrap-core';
import { AccountKeyLinkTransaction, Deadline, LinkAction, VotingKeyLinkTransaction, VrfKeyLinkTransaction } from 'symbol-sdk';
import { nodesMetadata, TransactionInformation } from '../model';
import { KeyStore, NetworkAccountResolver, NetworkConfigurationService, NetworkUtils } from '../services';

export interface KnownPeersInformation {
    'api-node': PeerInfo[];
    'peer-node': PeerInfo[];
}
export interface GenerateNemesisParams {
    regenerate: boolean;
    composeUser?: string;
}

export class NetworkGenesisService {
    constructor(private readonly logger: Logger, private readonly workingDir: string, private readonly keyStore: KeyStore) {}

    public async generateNemesis({ regenerate, composeUser }: GenerateNemesisParams): Promise<string> {
        const input = await NetworkUtils.loadNetwork(this.workingDir);
        if (!BootstrapUtils.isYmlFile(input.preset) || !input.isNewNetwork) {
            throw new Error(`You are creating nodes for an existing network. Nemesis cannot be generated!`);
        }
        if (input.nemesisSeedFolder && existsSync(input.nemesisSeedFolder) && !regenerate) {
            throw new Error(`The nemesis block has been previously generated.`);
        }
        this.logger.info('');
        const transactions: TransactionInformation[] = [];

        const deadline = Deadline.createFromDTO('1');
        const knownPeers: KnownPeersInformation = {
            'api-node': [],
            'peer-node': [],
        };
        const nemesisBalances: {
            mosaicIndex: number;
            address: string;
            amount: number;
        }[] = [];

        const service = new BootstrapService(this.logger);
        const knownRestGateways = [];
        const nemesisTargetFolder = join(this.workingDir, 'nemesis-target');
        const nodesFolder = join(this.workingDir, 'nodes');
        await BootstrapUtils.deleteFolder(this.logger, nemesisTargetFolder);
        await BootstrapUtils.deleteFolder(this.logger, nodesFolder);
        this.logger.info('');
        const networkPreset: CustomPreset = await NetworkConfigurationService.updateNetworkPreset(
            input,
            this.keyStore,
            ConfigLoader.loadNetworkPreset(input.preset, this.workingDir),
        );
        await BootstrapUtils.writeYaml(join(this.workingDir, input.preset), networkPreset, undefined);
        const nemesisGenerationHashSeed = input.nemesisGenerationHashSeed;
        const networkType = input.networkType;
        const nemesisPreset = networkPreset.nemesis as NemesisPreset;
        if (!nemesisPreset) {
            throw new Error('Nemesis must be resolved from network preset!');
        }
        if (!nemesisPreset.mosaics) throw new Error(`Network nemesis's mosaics must be found!`);

        const founderAccount = await this.keyStore.getNetworkAccount(networkType, 'founder', true);
        for (const node of input.nodes) {
            const metadata = nodesMetadata[node.nodeType];
            const hostname = node.hostname;
            const nodeId = `node-${NetworkUtils.zeroPad(node.number, 3)}`;
            this.logger.info(`Generating transactions and balances for node ${nodeId} ${hostname}`);
            const nodeName = 'node';
            const mainAccount = await this.keyStore.getNodeAccount(networkType, KeyName.Main, nodeName, node, true);
            const vrfAccount = await this.keyStore.getNodeAccount(networkType, KeyName.VRF, nodeName, node, true);
            const remoteAccount = await this.keyStore.getNodeAccount(networkType, KeyName.Remote, nodeName, node, true);
            const roles: string[] = [];
            //Api,Peer,Voting
            if (metadata.api) {
                roles.push('Api');
            }
            if (metadata.peer) {
                roles.push('Peer');
            }
            if (metadata.voting) {
                roles.push('Voting');
            }
            const peerInfo: PeerInfo = {
                publicKey: mainAccount.publicKey,
                endpoint: {
                    host: node.hostname,
                    port: 7900,
                },
                metadata: {
                    name: node.friendlyName,
                    roles: roles.join(','),
                },
            };

            if (metadata.api) {
                knownRestGateways.push(`http://${hostname}:3000`);
                knownPeers['api-node'].push(peerInfo);
            } else {
                knownPeers['peer-node'].push(peerInfo);
            }

            nemesisPreset.mosaics.forEach((m, mosaicIndex) => {
                const nodeBalance = node.balances[mosaicIndex] || 0;
                if (nodeBalance) {
                    const divisibility = nemesisPreset.mosaics[mosaicIndex].divisibility;
                    if (divisibility == undefined) {
                        throw new Error('Divisibility should be defined!!');
                    }
                    nemesisBalances.push({
                        mosaicIndex: mosaicIndex,
                        address: mainAccount.address.plain(),
                        amount: parseInt(nodeBalance + NetworkUtils.zeroPad(0, divisibility)),
                    });
                }
            });

            if (vrfAccount) {
                const transaction = VrfKeyLinkTransaction.create(deadline, vrfAccount.publicKey, LinkAction.Link, networkType);
                transactions.push({
                    nodeNumber: node.number,
                    type: 'VRF',
                    typeNumber: 1,
                    payload: mainAccount.sign(transaction, nemesisGenerationHashSeed).payload,
                });
            }

            if (remoteAccount) {
                const transaction = AccountKeyLinkTransaction.create(deadline, remoteAccount.publicKey, LinkAction.Link, networkType);
                transactions.push({
                    nodeNumber: node.number,
                    type: 'Remote',
                    typeNumber: 2,
                    payload: mainAccount.sign(transaction, nemesisGenerationHashSeed).payload,
                });
            }

            if (metadata.voting) {
                const votingKeyDesiredLifetime = node.customPreset?.votingKeyDesiredLifetime || networkPreset.votingKeyDesiredLifetime;
                if (!votingKeyDesiredLifetime) {
                    throw new Error('votingKeyDesiredLifetime must be resolved!');
                }

                const votingFileData = await this.keyStore.getVotingKeyFile(networkType, nodeName, node, 1, votingKeyDesiredLifetime);

                const transaction = VotingKeyLinkTransaction.create(
                    deadline,
                    votingFileData.publicKey,
                    votingFileData.startEpoch,
                    votingFileData.endEpoch,
                    LinkAction.Link,
                    networkType,
                    1,
                );
                transactions.push({
                    nodeNumber: node.number,
                    type: 'Voting',
                    typeNumber: 3,
                    payload: mainAccount.sign(transaction, nemesisGenerationHashSeed).payload,
                });
            }
        }
        const nemesisSigner = await this.keyStore.getNetworkAccount(networkType, 'nemesisSigner', false);
        networkPreset.knownPeers = knownPeers;
        networkPreset.knownRestGateways = knownRestGateways;
        await BootstrapUtils.writeYaml(join(this.workingDir, input.preset), networkPreset, undefined);
        this.logger.info('');
        this.logger.info(`The ${input.preset} file has been updated!`);
        this.logger.info('');
        const nemesisTransactions: Record<string, string> = _.mapValues(
            _.keyBy(transactions, (transaction) => NetworkUtils.getTransactionKey(transaction)),
            (transaction) => transaction.payload,
        );

        const faucetBalances = input.faucetBalances;
        const faucetAccount = faucetBalances ? await this.keyStore.getNetworkAccount(networkType, 'faucet', true) : undefined;
        if (faucetBalances && faucetAccount) {
            nemesisPreset.mosaics.forEach((m, mosaicIndex) => {
                const faucetBalance = input.faucetBalances?.[mosaicIndex];
                if (faucetBalance) {
                    const divisibility = nemesisPreset.mosaics[mosaicIndex].divisibility;
                    if (divisibility == undefined) {
                        throw new Error('Divisibility should be defined!!');
                    }
                    nemesisBalances.push({
                        mosaicIndex: mosaicIndex,
                        address: faucetAccount.address.plain(),
                        amount: parseInt(faucetBalance + NetworkUtils.zeroPad(0, divisibility)),
                    });
                }
            });
        }

        const nemesisCustomPreset: CustomPreset = {
            nemesisSeedFolder: '',
            nodes: [
                {
                    excludeFromNemesis: true, // Don't include this node links or balances!!!
                    friendlyName: 'nemesis-private-node',
                    host: 'nemesis-private-node',
                },
            ],
            nemesis: {
                nemesisSignerPrivateKey: nemesisSigner.privateKey,
                mosaics: nemesisPreset.mosaics.map((m, index) => ({
                    accounts: [founderAccount.publicKey],
                    currencyDistributions: nemesisBalances.filter((n) => n.mosaicIndex === index).map(({ mosaicIndex, ...rest }) => rest),
                })),
                transactions: nemesisTransactions,
            },
            faucets: [
                {
                    repeat: faucetAccount ? 1 : 0,
                    privateKey: faucetAccount?.privateKey,
                },
            ],
        };
        this.logger.info(`Generating nemesis block...`);
        this.logger.info('');
        const node = input.nodes.find(async (node) => {
            const metadata = nodesMetadata[node.nodeType];
            return metadata.harvesting;
        });
        if (!node) {
            throw new Error('No Candidate Node!!');
        }
        await service.config({
            user: BootstrapUtils.CURRENT_USER,
            accountResolver: new NetworkAccountResolver(this.logger, node, this.keyStore),
            workingDir: this.workingDir,
            target: nemesisTargetFolder,
            preset: input.preset,
            upgrade: false,
            reset: true,
            report: true,
            assembly: Assembly.demo,
            customPresetObject: nemesisCustomPreset,
        });
        await service.compose({
            target: nemesisTargetFolder,
            user: composeUser || ConfigService.defaultParams.user,
            upgrade: true,
        });
        const nemesisSeedFolder = NetworkUtils.NEMESIS_SEED_FOLDER;
        await BootstrapUtils.copyDir(join(nemesisTargetFolder, 'nemesis', 'seed'), join(this.workingDir, nemesisSeedFolder));
        input.nemesisSeedFolder = nemesisSeedFolder;
        await NetworkUtils.saveNetwork(this.workingDir, CryptoUtils.removePrivateKeys(input));
        return nemesisTargetFolder;
    }
}
