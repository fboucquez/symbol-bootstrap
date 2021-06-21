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
import { prompt } from 'inquirer';
import { join } from 'path';
import { BootstrapUtils, ConfigLoader, CustomPreset, Logger, LoggerFactory, LogType, NemesisPreset, Preset } from 'symbol-bootstrap-core';
import {
    AwsNodeData,
    AwsNodeSize,
    DeploymentType,
    Network,
    NetworkConfigurationService,
    NetworkInputFile,
    NetworkUtils,
    NodeMetadataType,
    nodesAwsMetadata,
    nodesMetadata,
    NodeTypeInput,
    Region,
    toDescription,
    toNetworkType,
} from 'symbol-network-core';
import { Account, NetworkType } from 'symbol-sdk';
import { NetworkCommandUtils } from './';

export interface InitServiceParams {
    readonly ready: boolean;
    readonly showPrivateKeys: boolean;
    readonly password?: string;
    readonly noPassword: boolean;
    readonly additionalNetworkPreset?: CustomPreset; //FOR TEST!
}

export class InitService {
    constructor(private readonly logger: Logger, private readonly workingDir: string, private readonly params: InitServiceParams) {}
    async execute(): Promise<void> {
        const networkInputFile = NetworkUtils.NETWORK_INPUT_FILE;
        const customNetworkPresetFile = NetworkUtils.NETWORK_PRESET_FILE;
        const logger = LoggerFactory.getLogger(LogType.Console);

        console.log();
        console.log(`Welcome to the ${NetworkCommandUtils.CLI_TOOL} tool. `);
        console.log();
        console.log('This tool will allow you creating a new network or a node cluster for an existing network.');

        console.log();
        console.log('First you need to decide if you are creating a new network or creating nodes to join an existing network.');
        console.log();

        const isNewNetwork = await this.confirm('Are you creating a new network?');
        if (isNewNetwork) {
            console.log();
            console.log(
                'The new network will be based on an existing network. You can select an out-of-the box preset from Symbol Bootstrap or you can provide a custom network preset to be based one',
            );
            console.log();
        } else {
            console.log();
            console.log('The new nodes can join an existing public network or you can provide the custom network`s preset and seed.');
            console.log();
        }

        const { preset, nemesisSeedFolder } = await this.promptPreset(isNewNetwork);

        const domain = await this.promptDomain('Domain', 'Enter the domain to be used to be used in your nodes', 'mycompany.com');

        const suffix = await this.promptName('Suffix', `Enter a suffix for node generated domain names and urls`, 'myc');

        const networkPreset = ConfigLoader.loadNetworkPreset(preset, this.workingDir);
        const nemesisPreset = networkPreset.nemesis as NemesisPreset;
        if (!nemesisPreset) throw new Error('Network nemesis must be found!');
        if (!nemesisPreset.mosaics) throw new Error(`Network nemesis's mosaics must be found!`);

        let faucetBalances: number[] | undefined;
        if (isNewNetwork) {
            const keyStore = await NetworkCommandUtils.createStore(this.params, logger, false, this.workingDir);
            const network = await this.promptNetwork("What's the network type you want to create?", Network.privateTest);
            const networkType = await toNetworkType(network);
            const networkDescription = await this.promptDescription(
                'Network Name',
                `Enter a name for the network.`,
                `My Company ${toDescription(network)} Network`,
            );

            const nemesisGenerationHashSeed = await this.generateRandomKey(
                'Generation Hash Seed',
                'Enter the generation hash seed to identify the network',
                networkType,
            );

            const epochAdjustment = await this.promptNumber(
                'Epoch Adjustment',
                'Enter the epoch adjustment value to offset deadlines.',
                Math.floor(Date.now() / 1000),
            );

            networkPreset.baseNamespace = await this.promptName(
                'Network basename Alias',
                'Enter the basename for the network aliases',
                networkPreset.baseNamespace,
            );

            for (const [index, mosaic] of nemesisPreset.mosaics.entries()) {
                const currencyType = index == 0 ? 'Network' : index == 1 ? 'Harvest' : 'Custom';
                mosaic.name = await this.promptName(
                    `${currencyType} Currency Name`,
                    `Enter the alias for the ${currencyType} Currency`,
                    mosaic.name,
                );
            }

            const nemesisSignerAccount = await this.promptPrivateKey(networkType, 'Nemesis Signer Account');
            await keyStore.saveNetworkAccount(networkType, 'nemesisSigner', nemesisSignerAccount.privateKey);

            const founderAccount = await this.promptPrivateKey(networkType, 'Founder Account');
            await keyStore.saveNetworkAccount(networkType, 'founder', founderAccount.privateKey);
            faucetBalances = [];
            if (await this.confirm('Do you want to have a Faucet account?')) {
                const faucetAccount = await this.promptPrivateKey(networkType, 'Faucet Account');
                await keyStore.saveNetworkAccount(networkType, 'faucet', faucetAccount.privateKey);

                for (const mosaic of nemesisPreset.mosaics) {
                    const balance = await this.promptNumber(
                        'Balance',
                        `What's the initial ${mosaic.name} balance for the Faucet Account ${faucetAccount.address.plain()}?`,
                        Math.floor(mosaic.supply / 100 / Math.pow(10, mosaic.divisibility)) * 5,
                    );
                    faucetBalances.push(balance);
                }
            }

            const harvestNetworkFeeSinkAccount = await this.promptPrivateKey(networkType, 'Harvest Network Fee Sink Account');
            await keyStore.saveNetworkAccount(networkType, 'harvestNetworkFeeSink', harvestNetworkFeeSinkAccount.privateKey);

            const namespaceRentalFeeSinkAccount = await this.promptPrivateKey(networkType, 'Namespace Rental Fee Sink Account');
            await keyStore.saveNetworkAccount(networkType, 'namespaceRentalFeeSink', namespaceRentalFeeSinkAccount.privateKey);

            const mosaicRentalFeeSinkAccount = await this.promptPrivateKey(networkType, 'Mosaic Rental Fee Sink Account');
            await keyStore.saveNetworkAccount(networkType, 'mosaicRentalFeeSink', mosaicRentalFeeSinkAccount.privateKey);

            const rewardProgramControllerApiUrl = (await this.confirm('Do you want to host the node Reward Program?'))
                ? await this.promptUrl(
                      'Reward Controller URL',
                      'Enter the full url of the Reward Controller',
                      `http://${suffix}-node-monitoring.${domain}:7890`,
                  )
                : undefined;

            if (rewardProgramControllerApiUrl) {
                const rewardProgramEnrollmentAccount = await this.promptPrivateKey(networkType, 'Reward Program Enrollment Account');
                await keyStore.saveNetworkAccount(networkType, 'rewardProgramEnrollment', rewardProgramEnrollmentAccount.privateKey);
            }

            await NetworkConfigurationService.updateNetworkPreset(
                {
                    networkDescription,
                    networkType,
                    nemesisGenerationHashSeed,
                    epochAdjustment,
                    rewardProgramControllerApiUrl,
                },
                keyStore,
                networkPreset,
            );
            await BootstrapUtils.writeYaml(
                join(this.workingDir, customNetworkPresetFile),
                new ConfigLoader(logger).mergePresets(networkPreset, this.params.additionalNetworkPreset),
                undefined,
            );
            console.log();
            console.log(
                `The initial network preset ${customNetworkPresetFile} for the new network has been stored. This file will be updated in the following steps.`,
            );
            console.log();
        }

        const nemesisGenerationHashSeed = networkPreset.nemesisGenerationHashSeed;
        const epochAdjustment = networkPreset.epochAdjustment?.replace('s', '');
        const deploymentType = await this.promptDeploymentType();
        const nodeTypes = await this.promptNodeTypeInputList(nemesisPreset, deploymentType);
        const networkType = networkPreset.networkType;
        const networkDescription = networkPreset.networkDescription;
        if (!networkType) {
            throw new Error('networkType must be resolved!');
        }
        if (!epochAdjustment) {
            throw new Error('epochAdjustment must be resolved!');
        }
        if (!nemesisGenerationHashSeed) {
            throw new Error('nemesisGenerationHashSeed must be resolved!');
        }
        if (!networkDescription) {
            throw new Error('networkDescription must be resolved!');
        }
        const networkInput: NetworkInputFile = {
            preset: isNewNetwork ? customNetworkPresetFile : preset,
            domain: domain,
            suffix: suffix,
            networkDescription: networkDescription,
            networkType: networkType,
            nemesisGenerationHashSeed: nemesisGenerationHashSeed,
            epochAdjustment: parseInt(epochAdjustment),
            rewardProgramControllerApiUrl: networkPreset.rewardProgramControllerApiUrl,
            isNewNetwork: isNewNetwork,
            deploymentData: {
                type: deploymentType,
            },
            faucetBalances: faucetBalances,
            nemesisSeedFolder: nemesisSeedFolder,
            nodeTypes: nodeTypes,
        };

        await NetworkUtils.saveNetworkInput(this.workingDir, networkInput);
        console.log();
        console.log(`You have created the initial ${networkInputFile}. Have a look and once once you are happy, run: `);
        console.log();
        console.log(`$ ${NetworkCommandUtils.CLI_TOOL} expandNodes`);
        console.log();
    }

    public async confirm(question: string, defaultValue = true): Promise<boolean> {
        const { value } = await prompt([
            {
                name: 'value',
                message: question,
                type: 'confirm',
                default: defaultValue,
            },
        ]);
        return value;
    }

    public async promptPreset(isNewNetwork: boolean): Promise<{ preset: string; nemesisSeedFolder?: string }> {
        const message = isNewNetwork
            ? 'Select the Bootstrap profile to base your new network from:'
            : 'Select the Bootstrap profile for your nodes:';
        let preset: string = Preset.mainnet;
        let customFile = NetworkUtils.NETWORK_PRESET_FILE;
        let nemesisSeedFolder = 'nemesis-seed';
        while (true) {
            const choices = (isNewNetwork ? Object.values(Preset) : [Preset.testnet, Preset.mainnet]).map((e) => {
                return {
                    name: `${NetworkUtils.startCase(e)} Preset`,
                    value: e.toString(),
                };
            });
            choices.push({
                name: `Custom Preset (${customFile} file will be asked)`,
                value: 'custom',
            });
            const networkResponse = await prompt([
                {
                    name: 'value',
                    message: message,
                    type: 'list',
                    default: preset,
                    choices: choices,
                },
            ]);
            preset = networkResponse.value;
            if (preset === 'custom') {
                const customPresetResponse = await prompt([
                    {
                        name: 'value',
                        message: "Enter the filename of the the custom network's preset:",
                        default: customFile,
                        validate(input: string): boolean | string {
                            if (!BootstrapUtils.isYmlFile(input)) {
                                return 'is not a YAML file';
                            }
                            return true;
                        },
                        type: 'input',
                    },
                ]);

                customFile = customPresetResponse.value;
                if (!existsSync(customFile)) {
                    console.log();
                    console.log(`Network file '${customFile}' does not exist! Please re-enter`);
                    console.log();
                    continue;
                }
                if (isNewNetwork) {
                    return { preset: customFile };
                }
                const nemesisSeedFolderResponse = await prompt([
                    {
                        name: 'value',
                        message: 'Enter the folder name where the custom network seed can be found:',
                        default: nemesisSeedFolder,
                        type: 'input',
                    },
                ]);
                nemesisSeedFolder = nemesisSeedFolderResponse.value;
                try {
                    await BootstrapUtils.validateSeedFolder(nemesisSeedFolder, '');
                } catch (e) {
                    console.log();
                    console.log(`Network nemesis seed '${nemesisSeedFolder}' is not valid! Please re-enter: Error: ${e.message}`);
                    console.log();
                    continue;
                }
                return {
                    preset: customFile,
                    nemesisSeedFolder: nemesisSeedFolder,
                };
            }
            return { preset: preset };
        }
    }

    public async promptNetwork(message: string, defaultNetwork: Network): Promise<Network> {
        const responses = await prompt([
            {
                name: 'network',
                message: message,
                type: 'list',
                default: defaultNetwork,
                choices: Object.values(Network).map((e) => {
                    return {
                        name: toDescription(e),
                        value: e,
                    };
                }),
            },
        ]);
        return responses.network;
    }

    public async promptDeploymentType(): Promise<DeploymentType> {
        const responses = await prompt([
            {
                name: 'deploymentType',
                message: 'Select the cloud provided for the deployment',
                type: 'list',
                default: DeploymentType.CUSTOM,
                choices: Object.values(DeploymentType).map((e) => {
                    return {
                        name: e,
                        value: e,
                    };
                }),
            },
        ]);
        return responses.deploymentType;
    }

    public async promptAwsRegion(message: string): Promise<Region> {
        const responses = await prompt([
            {
                name: 'region',
                message,
                type: 'list',
                default: Region['us-east-1'],
                choices: Object.values(Region).map((e) => {
                    return {
                        name: e,
                        value: e,
                    };
                }),
            },
        ]);
        return responses.region;
    }

    public async promptAwsNodeSize(message: string, defaultNodeSize: AwsNodeSize | undefined): Promise<AwsNodeSize> {
        const responses = await prompt([
            {
                name: 'region',
                message,
                type: 'list',
                default: defaultNodeSize,
                choices: Object.values(AwsNodeSize).map((e) => {
                    return {
                        name: e,
                        value: e,
                    };
                }),
            },
        ]);
        return responses.region;
    }

    public async promptNodeTypeInputList(nemesis: NemesisPreset, deploymentType: DeploymentType): Promise<NodeTypeInput[]> {
        const list: NodeTypeInput[] = [];
        while (true) {
            console.log();
            console.log();
            const nodeType = await this.promptNodeType(`Select the node type you want to create`);
            const nodeTypeName = nodesMetadata[nodeType].name;
            const { total } = await prompt([
                {
                    name: 'total',
                    message: `How many nodes of type ${nodeTypeName} do you want to create?`,
                    type: 'number',
                    validate: (input) => {
                        if (!input) {
                            return 'is required';
                        }
                        if (input < 0) {
                            return 'number must not be negative';
                        }
                        return true;
                    },
                    default: 3,
                },
            ]);

            const balances: number[] = [];
            if (!nemesis) {
                throw new Error('Nemesis must be resolved!');
            }
            for (const [index, mosaic] of nemesis.mosaics.entries()) {
                const balance = await this.promptNumber(
                    'Balance',
                    `What's the initial ${mosaic.name} balance for the ${nodeTypeName} nodes?`,
                    nodesMetadata[nodeType].balances[index],
                );
                balances.push(balance);
            }

            const nickName = await this.promptName(
                `Nodes's Nick Name`,
                'The nick name of the these nodes',
                nodesMetadata[nodeType].nickName,
            );
            let awsNodeData: Partial<AwsNodeData> | undefined;
            if (deploymentType == DeploymentType.AWS) {
                const region = await this.promptAwsRegion('Select the region for these nodes');
                const nodeSize = await this.promptAwsNodeSize('The ec2 size for these images', nodesAwsMetadata[nodeType].nodeSize);

                const rootBlockSize = await this.promptNumber(
                    'Root Block Size',
                    'Enter the AWS ec2 volume size in GB',
                    nodesAwsMetadata[nodeType].rootBlockSize,
                );
                awsNodeData = {
                    nodeSize,
                    region,
                    rootBlockSize,
                };
            }

            const { confirmCreate } = await prompt([
                {
                    default: true,
                    message: `Do you want to create ${total} nodes of type ${nodeTypeName} each with balance of ${balances.join(', ')}?`,
                    type: 'confirm',
                    name: 'confirmCreate',
                },
            ]);
            if (confirmCreate) {
                list.push({
                    nickName: nickName,
                    nodeType: nodeType,
                    balances: balances,
                    total: total,
                    ...awsNodeData,
                });
            }
            const { confirmCreateMore } = await prompt([
                {
                    default: true,
                    message: `Do you want to create more nodes?`,
                    type: 'confirm',
                    name: 'confirmCreateMore',
                },
            ]);
            if (!confirmCreateMore) {
                return list;
            }
        }
    }

    public async promptNodeType(message: string): Promise<NodeMetadataType> {
        const responses = await prompt([
            {
                name: 'value',
                message: message,
                type: 'list',
                choices: Object.values(NodeMetadataType).map((e) => {
                    return {
                        name: nodesMetadata[e].name,
                        value: e,
                    };
                }),
            },
        ]);
        return responses.value;
    }

    public async promptPrivateKey(networkType: NetworkType, fieldName: string): Promise<Account> {
        const showPrivateKeys = this.params.showPrivateKeys;
        return this.confirmedPrompt<Account>(
            fieldName,
            async (currentValue): Promise<Account> => {
                const { value } = await prompt([
                    {
                        name: 'value',
                        message: `Enter the 64 HEX private key ${fieldName} (or press enter to accept the auto generated):`,
                        type: showPrivateKeys ? 'input' : 'password',
                        mask: showPrivateKeys ? '' : '*',
                        default: currentValue?.privateKey,
                        validate: BootstrapUtils.isValidPrivateKey,
                    },
                ]);
                return Account.createFromPrivateKey(value, networkType);
            },
            Account.generateNewAccount(networkType),
            (enteredAccount) => `address ${enteredAccount.address.plain()} public key ${enteredAccount.publicKey}`,
        );
    }

    public async generateRandomKey(fieldName: string, message: string, networkType: NetworkType): Promise<string> {
        return this.promptText(
            fieldName,
            message,
            Account.generateNewAccount(networkType).privateKey,

            BootstrapUtils.isValidPrivateKey,
        );
    }
    public async promptName(fieldName: string, message: string, defaultValue: string | undefined): Promise<string> {
        return this.promptText(fieldName, message, defaultValue, this.isValidName);
    }

    public async promptDescription(fieldName: string, message: string, defaultValue: string | undefined): Promise<string> {
        return this.promptText(fieldName, message, defaultValue, this.isValidDescription);
    }

    public async promptDomain(fieldName: string, message: string, defaultValue: string | undefined): Promise<string> {
        return this.promptText(fieldName, message, defaultValue, this.isValidDomain);
    }

    public async promptNumber(fieldName: string, message: string, defaultValue: number | undefined): Promise<number> {
        return this.confirmedPrompt(
            fieldName,
            async (currentValue) => {
                const { value } = await prompt([
                    {
                        name: 'value',
                        message: message,
                        type: 'number',
                        default: currentValue,
                        validate(input: any): boolean | string {
                            if (input === undefined) {
                                return 'is required';
                            }
                            if (input < 0) {
                                return 'must not be negative';
                            }
                            return true;
                        },
                    },
                ]);
                return value;
            },
            defaultValue,
        );
    }

    public async promptUrl(fieldName: string, message: string, defaultValue: string | undefined): Promise<string> {
        return this.promptText(fieldName, message, defaultValue, this.isValidUrl);
    }

    public async promptText(
        fieldName: string,
        message: string,
        defaultValue: string | undefined,

        validate?: (input: any) => boolean | string | Promise<boolean | string>,
    ): Promise<string> {
        return this.confirmedPrompt(
            fieldName,
            async (currentValue) => {
                const { value } = await prompt([
                    {
                        name: 'value',
                        message: message,
                        type: 'input',
                        default: currentValue,
                        validate: validate,
                    },
                ]);
                return value;
            },
            defaultValue,
        );
    }

    public async confirmedPrompt<T>(
        fieldName: string,
        valuePrompt: (defaultValue: T | undefined) => Promise<T>,
        defaultValue: T | undefined,
        toString: (o: T) => string = (o: T) => `${o}`,
    ): Promise<T> {
        let value = defaultValue;
        while (true) {
            value = await valuePrompt(value);
            if (this.params.ready) {
                return value;
            }
            const { confirm } = await prompt([
                {
                    default: true,
                    message: `Is the ${fieldName} ${toString(value)} correct?`,
                    type: 'confirm',
                    name: 'confirm',
                },
            ]);
            if (confirm) {
                return value;
            }
            console.log(`Please re-enter the ${fieldName}.`);
        }
    }

    public isValidName(input: string): boolean | string {
        if (!input) {
            return 'Must be provided';
        }
        if (input.match(/^[A-Za-z]+$/)) return true;
        else {
            return `${input} is not a valid name`;
        }
    }

    public isValidDescription(input: string): boolean | string {
        if (!input) {
            return 'Must be provided';
        }
        if (input.match(/^[a-z\d\-_\s]+$/i)) return true;
        else {
            return `${input} is not a valid description text`;
        }
    }

    public isValidDomain(input: string): boolean | string {
        const expression = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;

        if (!input) {
            return 'Must be provided';
        }
        if (input.match(expression)) return true;
        else {
            return `${input} is not a valid domain`;
        }
    }

    public isValidUrl(input: string): boolean | string {
        const expression =
            /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

        if (!input) {
            return 'Must be provided';
        }
        if (input.match(expression)) return true;
        else {
            return `${input} is not a valid url`;
        }
    }
}
