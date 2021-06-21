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

import { Command, flags } from '@oclif/command';
import { IOptionFlag } from '@oclif/command/lib/flags';
import { existsSync } from 'fs';
import { prompt } from 'inquirer';
import {
    Assembly,
    BootstrapService,
    BootstrapUtils,
    ConfigLoader,
    ConfigService,
    CustomPreset,
    KeyName,
    LoggerFactory,
    LogType,
    Preset,
    PrivateKeySecurityMode,
    RewardProgram,
} from 'symbol-bootstrap-core';
import { Account, NetworkType, PublicAccount } from 'symbol-sdk';
import { BootstrapCommandUtils } from '../service';

export const assembliesDescriptions: Record<Assembly, string> = {
    [Assembly.dual]: 'Dual Node',
    [Assembly.peer]: 'Peer Node',
    [Assembly.api]: 'Api Node',
    [Assembly.demo]: 'Demo Node',
    [Assembly.multinode]: 'Multinode Node. A docker compose that includes one api, one rest and two peers.',
};

export enum Network {
    mainnet = 'mainnet',
    testnet = 'testnet',
    singleCurrencyPrivateNetwork = 'singleCurrencyPrivateNetwork',
    dualCurrencyPrivateNetwork = 'dualCurrencyPrivateNetwork',
    customNetwork = 'customNetwork',
}

export const assemblies: Record<Network, Assembly[]> = {
    [Network.mainnet]: [Assembly.dual, Assembly.peer, Assembly.api],
    [Network.testnet]: [Assembly.dual, Assembly.peer, Assembly.api, Assembly.demo],
    [Network.singleCurrencyPrivateNetwork]: [Assembly.multinode, Assembly.dual, Assembly.peer, Assembly.api, Assembly.demo],
    [Network.dualCurrencyPrivateNetwork]: [Assembly.multinode, Assembly.dual, Assembly.peer, Assembly.api, Assembly.demo],
    [Network.customNetwork]: [Assembly.dual, Assembly.peer, Assembly.api],
};

export interface ProvidedAccounts {
    seeded: boolean;
    main: Account;
    remote: Account;
    vrf: Account;
    transport: Account;
    agent?: Account;
}

export const networkToPreset: Record<Network, string> = {
    [Network.singleCurrencyPrivateNetwork]: Preset.singleCurrency,
    [Network.dualCurrencyPrivateNetwork]: Preset.dualCurrency,
    [Network.mainnet]: Preset.mainnet,
    [Network.testnet]: Preset.testnet,
    [Network.customNetwork]: 'custom-network-preset.yml',
};

export default class Wizard extends Command {
    static description = 'An utility command that will help you configuring node!';

    static examples = [`$ symbol-bootstrap wizard`];

    static flags = {
        help: BootstrapCommandUtils.helpFlag,
        target: BootstrapCommandUtils.targetFlag,
        password: BootstrapCommandUtils.passwordFlag,
        noPassword: BootstrapCommandUtils.noPasswordFlag,
        network: Wizard.getNetworkIdFlag(),
        customPreset: Wizard.getCustomPresetFile(),
        ready: flags.boolean({
            description: 'If --ready is provided, the command will not ask offline confirmation.',
        }),
    };

    public async run(): Promise<void> {
        const flags = this.parse(Wizard).flags;
        return Wizard.execute(this.config.root, flags);
    }

    public static async execute(
        root: string,
        flags: {
            noPassword: boolean;
            skipPull?: boolean;
            target: string;
            password: string | undefined;
            network: Network | undefined;
            customPreset: string;
            ready?: boolean;
        },
    ): Promise<void> {
        const logger = LoggerFactory.getLogger(LogType.Console);
        BootstrapCommandUtils.showBanner();
        console.log('Welcome to the Symbol Bootstrap wizard! This command will:');
        console.log(' - Guide you through the configuration process.');
        console.log(' - Import Paper Wallet seeds.');
        console.log(` - Create a custom preset and show you the way to launch your node!`);
        console.log();
        const target = flags.target;

        const customPresetFile = flags.customPreset;
        if (existsSync(customPresetFile)) {
            throw new Error(`${customPresetFile} already exist!!! You should move the file somewhere else before overwriting it!`);
        }
        if (existsSync(target)) {
            throw new Error(
                'There is currently a ./target folder here!!!! Have you executed bootstrap already? You should move the folder somewhere else before overwriting it!',
            );
        }

        const network = await Wizard.resolveNetwork(flags.network);
        const preset = await Wizard.resolvePreset(network);
        const assembly = await Wizard.resolveAssembly(network);
        if (network == Network.dualCurrencyPrivateNetwork || network == Network.singleCurrencyPrivateNetwork) {
            console.log('For a private network, just run: ');
            console.log('');
            console.log(`$ symbol-bootstrap start -b ${preset} -a ${assembly}`);
            return;
        }

        if (!flags.skipPull) {
            const service = await new BootstrapService(logger);
            console.log();
            console.log('Pulling catapult tools image before asking to go offline...');
            console.log();
            ConfigLoader.presetInfoLogged = true;
            await BootstrapUtils.pullImage(
                logger,
                service.resolveConfigPreset({
                    ...ConfigService.defaultParams,
                    preset: preset,
                    assembly: assembly,
                    target: target,
                }).symbolServerImage,
            );
        }
        console.log();
        console.log();
        if (
            !flags.ready &&
            !(
                await prompt([
                    {
                        name: 'offlineNow',
                        message: `Symbol Bootstrap is about to start working with sensitive information (private keys or mnemonic phrases) so it is highly recommended that you disconnect from the network before continuing. Say YES if you are offline or if you don't care.`,
                        type: 'confirm',
                        default: true,
                    },
                ])
            ).offlineNow
        ) {
            console.log('Come back when you are offline...');
            return;
        }

        console.log();
        console.log(
            'Symbol bootstrap needs to provide the node with a number of key pairs (Read more at https://docs.symbolplatform.com/concepts/cryptography.html#symbol-keys).',
        );
        console.log(`If you don't know what a key is used for, let Symbol Bootstrap generate a new one for you.`);

        const password = await BootstrapCommandUtils.resolvePassword(
            logger,
            flags.password,
            flags.noPassword,
            BootstrapCommandUtils.passwordPromptDefaultMessage,
            false,
        );

        const rewardProgram = assembly === 'dual' ? await Wizard.resolveRewardProgram() : undefined;

        const networkType = network === Network.mainnet ? NetworkType.MAIN_NET : NetworkType.TEST_NET;
        const accounts = await Wizard.resolveAllAccounts(networkType, rewardProgram);

        console.log();
        console.log(`These are your node's accounts:`);
        Wizard.logAccount(accounts.main, KeyName.Main, false);
        Wizard.logAccount(accounts.vrf, KeyName.VRF, false);
        Wizard.logAccount(accounts.remote, KeyName.Remote, false);
        Wizard.logAccount(accounts.transport, KeyName.Transport, false);
        Wizard.logAccount(accounts.agent, KeyName.Agent, false);
        console.log();
        console.log();

        const symbolHostRequired = !!rewardProgram;
        const host = await Wizard.resolveHost(
            `Enter the public hostname or IP of your future node. ${
                symbolHostRequired ? 'This value is required when you are in a reward program!' : ''
            }`,
            symbolHostRequired,
        );
        const friendlyName = await Wizard.resolveFriendlyName(host || accounts.main.publicKey.substr(0, 7));
        const privateKeySecurityMode = await Wizard.resolvePrivateKeySecurityMode();
        const voting = await Wizard.isVoting();
        const presetContent: CustomPreset = {
            assembly: assembly,
            preset: preset,
            privateKeySecurityMode: privateKeySecurityMode,
            nodes: [
                {
                    host: host,
                    voting: voting,
                    friendlyName: friendlyName,
                    rewardProgram: rewardProgram,
                    mainPrivateKey: accounts.main.privateKey,
                    vrfPrivateKey: accounts.vrf.privateKey,
                    remotePrivateKey: accounts.remote.privateKey,
                    transportPrivateKey: accounts.transport.privateKey,
                    agentPrivateKey: accounts.agent?.privateKey,
                },
            ],
        };
        const defaultParams = ConfigService.defaultParams;
        await BootstrapUtils.writeYaml(customPresetFile, presetContent, password);
        console.log();
        console.log();
        console.log(`The Symbol Bootstrap preset file '${customPresetFile}' has been created!!!. Keep this safe!`);
        console.log();
        console.log(`To decrypt the node's private key, run: `);
        console.log();
        console.log(`$ symbol-bootstrap decrypt --source ${customPresetFile} --destination plain-custom-preset.yml`);
        console.log();
        console.log('Remember to delete the plain-custom-preset.yml file after used!!!');

        console.log(
            `You can edit this file to further customize it. Read more https://github.com/symbol/symbol-bootstrap/blob/main/docs/presetGuides.md`,
        );
        console.log();
        console.log(`Once you have finished the custom preset customization, You can use the 'start' to run the node in this machine:`);
        console.log();
        const targetParam = target !== defaultParams.target ? `-t ${target}` : '';
        console.log(`$ symbol-bootstrap start -c ${customPresetFile} ${targetParam}`);

        console.log();
        console.log(`Alternatively, to create a zip file that can be deployed in your node machine you can use the 'pack' command:`);
        console.log();
        console.log(`$ symbol-bootstrap pack -c ${customPresetFile} ${targetParam}`);
        console.log();
        console.log(
            `Once the target folder is created, Bootstrap will use the protected and encrypted addresses.yml, and preset.yml in inside the target folder.`,
        );
        console.log(
            'To upgrade your node version or configuration, use the --upgrade parameter in config, compose, start and/or pack. Remember to backup the node`s target folder!',
        );
        console.log(
            'Hint: You can change the configuration of an already created node by proving a new custom preset. This is an experimental feature, backup the target folder before!',
        );
        console.log();
        console.log('To complete the registration, you need to link your keys (online):');
        console.log();
        console.log(`$ symbol-bootstrap link --useKnownRestGateways -c ${customPresetFile}`);
        if (rewardProgram == RewardProgram.SuperNode) {
            console.log();
            console.log('To enroll to the supernode program, run (online):');
            console.log();
            console.log(`$ symbol-bootstrap enrollRewardProgram  --useKnownRestGateways -c ${customPresetFile}`);
        }
        console.log();
    }
    public static logAccount<T extends Account | PublicAccount | undefined>(account: T, keyName: KeyName, showPrivateKeys: boolean): T {
        if (account === undefined) {
            return account;
        }
        const privateKeyText = showPrivateKeys && account instanceof Account ? `\n\tPrivate Key: ${account.privateKey}` : '';
        console.log(` - ${keyName}:\n\tAddress:     ${account.address.plain()}\n\tPublic Key:  ${account.publicKey}${privateKeyText}`);
        return account as T;
    }

    private static async resolveAllAccounts(networkType: NetworkType, rewardProgram: RewardProgram | undefined): Promise<ProvidedAccounts> {
        console.log();
        return {
            seeded: true,
            main: await this.resolveAccountFromSelection(
                networkType,
                KeyName.Main,
                'It holds the tokens required to give the node its importance.',
            ),
            transport: await this.resolveAccountFromSelection(
                networkType,
                KeyName.Transport,
                'It is used by nodes for secure transport over TLS.',
            ),
            vrf: await this.resolveAccountFromSelection(networkType, KeyName.VRF, 'It is required for harvesting.'),
            remote: await this.resolveAccountFromSelection(
                networkType,
                KeyName.Remote,
                'It is used to harvest and collect the rewards on behalf of the main account in remote harvesting.',
            ),
            agent: rewardProgram
                ? await this.resolveAccountFromSelection(
                      networkType,
                      KeyName.Agent,
                      'It is used to create TLS certificates request for the Controller to Agent communication.',
                  )
                : undefined,
        };
    }

    public static async resolveAccountFromSelection(networkType: NetworkType, keyName: KeyName, keyDescription: string): Promise<Account> {
        console.log(`${keyName} Key Pair: ${keyDescription}`);
        while (true) {
            const keyCreationChoices = [];
            keyCreationChoices.push({ name: 'Generating a new account', value: 'generate' });
            keyCreationChoices.push({ name: 'Entering a private key', value: 'manual' });
            const { keyCreationMode } = await prompt([
                {
                    name: 'keyCreationMode',
                    message: `How do you want to create the ${keyName} account:`,
                    type: 'list',
                    default: keyCreationChoices[0].name,
                    choices: keyCreationChoices,
                },
            ]);
            const log = (account: Account, message: string): Account => {
                console.log();
                console.log(`Using account ${account.address.plain()} for ${keyName} key. ${message}`);
                console.log();
                return account;
            };
            if (keyCreationMode == 'generate') {
                return log(this.generateAccount(networkType), 'It will be stored in your custom preset. Keep file safe!');
            }
            // manual
            const account = await Wizard.resolveAccount(networkType, keyName);
            if (account) {
                return log(
                    account,
                    'It will be stored in your custom preset. You can recreate the account by providing the private key again!',
                );
            }
        }
    }

    public static generateAccount(networkType: NetworkType): Account {
        return Account.generateNewAccount(networkType);
    }

    public static async resolveAccount(networkType: NetworkType, keyName: KeyName): Promise<Account | undefined> {
        while (true) {
            const { privateKey } = await prompt([
                {
                    name: 'privateKey',
                    message: `Enter the 64 HEX private key of the ${keyName} account (or press enter to select the option again).`,
                    type: 'password',
                    mask: '*',
                    validate: (value) => {
                        if (!value) {
                            return true;
                        }
                        return BootstrapUtils.isValidPrivateKey(value);
                    },
                },
            ]);
            if (!privateKey) {
                return undefined;
            } else {
                const enteredAccount = Account.createFromPrivateKey(privateKey, networkType);
                const { ok } = await prompt([
                    {
                        name: 'ok',
                        message: `Is this the expected address ${enteredAccount.address.plain()} to used as ${keyName} account? `,
                        type: 'confirm',
                        default: false,
                    },
                ]);
                if (ok) {
                    return enteredAccount;
                }
            }
        }
    }

    public static async resolveNetwork(providedNetwork: Network | undefined): Promise<Network> {
        if (!providedNetwork) {
            console.log('Select type node or network you want to run:\n');
            const responses = await prompt([
                {
                    name: 'network',
                    message: 'Select a network:',
                    type: 'list',
                    default: Network.mainnet,
                    choices: [
                        { name: 'Mainnet Node', value: Network.mainnet },
                        { name: 'Testnet Node', value: Network.testnet },
                        { name: 'Dual Currency Local Private Network', value: Network.singleCurrencyPrivateNetwork },
                        { name: 'Single Currency Local Private Network', value: Network.dualCurrencyPrivateNetwork },
                        {
                            name: `Custom Network Node ('custom-network-preset.yml' file and 'nemesis-seed' folder are required)`,
                            value: Network.customNetwork,
                        },
                    ],
                },
            ]);
            return responses.network;
        }
        return providedNetwork;
    }

    public static async resolvePreset(network: Network): Promise<string> {
        if (network === Network.customNetwork) {
            console.log(
                `Enter the network preset you want to join. If you don't know have the network preset, ask the network admin for the file and nemesis seed. :\n`,
            );
            const responses = await prompt([
                {
                    name: 'networkPresetFile',
                    message: 'Enter the network a network:',
                    type: 'input',
                    validate(input: string): string | boolean {
                        if (!BootstrapUtils.isYmlFile(input)) {
                            return `${input} is not a yaml file`;
                        }
                        if (!existsSync(input)) {
                            return `${input} doesn't exist`;
                        }
                        return true;
                    },
                    default: networkToPreset[network],
                },
            ]);
            return responses.networkPresetFile;
        }
        return networkToPreset[network];
    }

    public static async resolvePrivateKeySecurityMode(): Promise<PrivateKeySecurityMode> {
        const { mode } = await prompt([
            {
                name: 'mode',
                message: 'Select the type of security you want to use:',
                type: 'list',
                default: PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
                choices: [
                    {
                        name: 'PROMPT_MAIN: Bootstrap may ask for the Main private key when doing certificates upgrades. Other keys are encrypted. Recommended for Supernodes.',
                        value: PrivateKeySecurityMode.PROMPT_MAIN,
                    },
                    {
                        name: 'PROMPT_MAIN_TRANSPORT: Bootstrap may ask for the Main and Transport private keys when regenerating certificates and agent configuration. Other keys are encrypted. Recommended for regular nodes',
                        value: PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT,
                    },
                    { name: 'ENCRYPT: All keys are encrypted, only password would be asked', value: PrivateKeySecurityMode.ENCRYPT },
                ],
            },
        ]);
        return mode;
    }

    public static async resolveAssembly(network: Network): Promise<string> {
        console.log('Select the assembly to be created:\n');
        const responses = await prompt([
            {
                name: 'assembly',
                message: 'Select an assembly:',
                type: 'list',
                default: assemblies[network][0],
                choices: assemblies[network].map((value) => ({
                    value: value,
                    name: assembliesDescriptions[value],
                })),
            },
        ]);
        return responses.assembly;
    }

    private static async isVoting(): Promise<boolean> {
        console.log(
            'Select whether your Symbol node should be a Voting node. Note: A Voting node requires the main account to hold at least 3 million XYMs. ',
        );
        console.log('If your node does not have enough XYMs its Voting key may not be included. ');
        const { voting } = await prompt([
            {
                name: 'voting',
                message: 'Are you creating a Voting node?',
                type: 'confirm',
                default: false,
            },
        ]);
        return voting;
    }

    public static getNetworkIdFlag(): IOptionFlag<Network | undefined> {
        return flags.string({
            description: 'The node or network you want to create',
            options: Object.values(Network),
        }) as IOptionFlag<Network | undefined>;
    }

    public static getCustomPresetFile(): IOptionFlag<string> {
        return flags.string({ char: 'c', description: 'The custom preset to be created.', default: 'custom-preset.yml' });
    }

    public static async resolveRewardProgram(): Promise<RewardProgram | undefined> {
        const { value } = await prompt([
            {
                name: 'value',
                message: 'Select your Symbol Reward Program:',
                type: 'list',
                default: 'None',
                choices: [
                    { name: 'None. Just a standard node.', value: 'None' },
                    { name: RewardProgram.SuperNode, value: RewardProgram.SuperNode },
                    {
                        name: RewardProgram.EarlyAdoption + ' (only if you have pre-enrolled using the Nis1 Transfer transaction)',
                        value: RewardProgram.EarlyAdoption,
                    },
                    {
                        name: RewardProgram.Ecosystem + ' (only if you have pre-enrolled using the Nis1 Transfer transaction)',
                        value: RewardProgram.Ecosystem,
                    },
                ],
            },
        ]);
        if (value === 'None') {
            return undefined;
        }
        return value;
    }

    public static async resolveHost(message: string, required: boolean): Promise<string> {
        const { host } = await prompt([
            {
                name: 'host',
                message: message,
                type: 'input',
                validate: (value) => {
                    if (!required && !value) {
                        return true;
                    }
                    return Wizard.isValidHost(value);
                },
            },
        ]);
        return host || undefined;
    }

    public static isValidHost(input: string): boolean | string {
        if (input.trim() == '') {
            return 'Host is required.';
        }
        if (input.length > 50) {
            return `Input (${input.length}) is larger than 50`;
        }
        const valid =
            /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(
                input,
            );
        return valid ? true : `It's not a valid IP or hostname`;
    }

    public static isValidFriendlyName(input: string): boolean | string {
        if (input.trim() == '') {
            return 'Friendly name is required.';
        }
        if (input.length > 30) {
            return `Input (${input.length}) is larger than 30`;
        }
        return true;
    }
    public static async resolveFriendlyName(defaultFriendlyName: string): Promise<string> {
        const { friendlyName } = await prompt([
            {
                name: 'friendlyName',
                message: `Enter the friendly name of your node.`,
                type: 'input',
                default: defaultFriendlyName,
                validate: Wizard.isValidFriendlyName,
            },
        ]);
        return friendlyName;
    }
}
