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
import { ExtendedKey, MnemonicPassPhrase, Network as SeedNetwork, Wallet } from 'symbol-hd-wallets';
import { Account, NetworkType } from 'symbol-sdk';
import { PrivateKeySecurityMode } from '../model';
import { BootstrapService, BootstrapUtils, CommandUtils, ConfigService, KeyName, Preset, RewardProgram, ZipUtils } from '../service';

export const assemblies: Record<Preset, { value: string; description: string }[]> = {
    [Preset.bootstrap]: [
        { value: '', description: 'Default: A network with 2 peers, a api, a broker, a mongo db, and a Rest Gateway' },
        { value: 'full', description: 'Full: A complete network with a private Explorer, Faucet and Wallet' },
        { value: 'light', description: 'Light: A light network with a dual, a mongo dn and a rest gateway' },
    ],
    [Preset.mainnet]: [
        { value: 'peer', description: 'Peer Node' },
        { value: 'api', description: 'Api  Node' },
        { value: 'dual', description: 'Dual Node' },
    ],
    [Preset.testnet]: [
        { value: 'peer', description: 'Peer Node' },
        { value: 'api', description: 'Api  Node' },
        { value: 'dual', description: 'Dual Node' },
    ],
};
export enum Network {
    mainnet = 'mainnet',
    testnet = 'testnet',
    privateNetwork = 'privateNetwork',
}

export enum ImportType {
    OPTIN_PAPER_WALLET = 'optinPaperWallet',
    SYMBOL_PAPER_WALLET = 'symbolPaperWallet',
    PRIVATE_KEYS = 'privateKeys',
}

export interface DerivedAccount {
    optinMode: boolean;
    networkType: NetworkType;
    account: Account;
    accountIndex: number;
    changeIndex: number;
    mnemonicPassPhrase: MnemonicPassPhrase;
}

export interface BootstrapPresetContent {
    preset?: string;
    assembly?: string;
    privateKeySecurityMode?: PrivateKeySecurityMode;
    nodes: {
        voting: boolean;
        host?: string | undefined;
        friendlyName?: string;
        rewardProgram?: RewardProgram;
        mainPrivateKey: string;
        transportPrivateKey: string;
        remotePrivateKey: string;
        vrfPrivateKey: string;
        votingPrivateKey?: string;
    }[];
}

export interface ProvidedAccounts {
    seeded: boolean;
    main: Account;
    remote: Account;
    vrf: Account;
    voting?: Account;
    transport: Account;
}

export const networkToPreset: Record<Network, Preset> = {
    [Network.privateNetwork]: Preset.bootstrap,
    [Network.mainnet]: Preset.mainnet,
    [Network.testnet]: Preset.testnet,
};
export default class Wizard extends Command {
    static description = 'An utility command that will help you configuring node!';

    static examples = [`$ symbol-bootstrap wizard`];

    static flags = {
        help: CommandUtils.helpFlag,
        target: CommandUtils.targetFlag,
        password: CommandUtils.passwordFlag,
        noPassword: CommandUtils.noPasswordFlag,
        network: Wizard.getNetworkIdFlag(),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Wizard);
        BootstrapUtils.showBanner();
        console.log('Welcome to the Symbol Bootstrap wizard! This command will:');
        console.log(' - Guide you through the configuration process.');
        console.log(' - Import Paper Wallet seeds.');
        console.log(` - Create a custom preset and show you the way to launch your node!`);

        const network = await Wizard.resolveNetwork(flags.network);
        const preset = networkToPreset[network];
        const assembly = await Wizard.resolveAssembly(preset);
        if (network == Network.privateNetwork) {
            console.log('For a private network, just run: ');
            console.log('');
            console.log(`$ symbol-bootstrap start -b ${preset}${assembly ? ` -a ${assembly}` : ''}`);
            return;
        }
        const password = await CommandUtils.resolvePassword(
            flags.password,
            flags.noPassword,
            CommandUtils.passwordPromptDefaultMessage,
            false,
        );
        const voting = await Wizard.isVoting();
        const importMode = await Wizard.resolveImportMode();
        const networkType = network === Network.mainnet ? NetworkType.MAIN_NET : NetworkType.TEST_NET;
        const accounts = await this.resolveAccounts(importMode, networkType, voting);
        const rewardProgram = await Wizard.resolveRewardProgram();
        const symbolHostRequired = !!rewardProgram;
        const host = await Wizard.resolveHost(
            `Enter the Symbol host of your future node. ${
                symbolHostRequired ? 'Hostname is required when you are in a reward program' : ''
            }`,
            symbolHostRequired,
        );
        const friendlyName = await Wizard.resolveFriendlyName();

        const privateKeySecurityMode = await Wizard.resolvePrivateKeySecurityMode();
        const presetContent: BootstrapPresetContent = {
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
                    votingPrivateKey: accounts.voting?.privateKey,
                },
            ],
        };
        const file = `custom-${password ? 'encrypted' : 'plain-text'}-${network}-preset.yml`;
        if (existsSync(file)) {
            throw new Error(`${file} already exist!!! you may want to move it somewhere else before overwriting it!`);
        }
        await BootstrapUtils.writeYaml(file, presetContent, password);
        console.log(`Symbol Bootstrap preset file '${file}' created. Keep this safe!`);
        const targetZip = `${network}-${assembly}-node.zip`;
        const defaultParams = ConfigService.defaultParams;
        if (!existsSync(defaultParams.target)) {
            console.log();
            console.log(`If you like you can generate the node's configuration now.`);
            console.log(`The configuration would be zipped and it can be deployed into your real node.`);
            console.log(`Only the required private keys for upgrades would be stored in the encrypted addresses.yml`);
            console.log(
                `Note: This next step requires docker access to download the server docker image if it hasn\`t been pulled already.`,
            );
            console.log();
            const { generateConfigurationNow } = await prompt([
                {
                    name: 'generateConfigurationNow',
                    message: `Would you like to generate the configuration now?`,
                    type: 'confirm',
                    default: false,
                },
            ]);
            if (generateConfigurationNow) {
                const service = new BootstrapService(this.config.root);
                await service.config({
                    ...defaultParams,
                    preset: preset,
                    assembly: assembly,
                    password: password,
                    customPresetObject: presetContent,
                });
                await service.compose({
                    ...defaultParams,
                    password: password,
                });
            }
            await ZipUtils.zip(targetZip, [
                {
                    from: defaultParams.target,
                    to: 'target',
                    directory: true,
                },
            ]);
        } else {
            console.log(`WARNING: The target folder ${defaultParams.target} already exist. Are you sure you want to run the wizard?`);
        }

        console.log();
        console.log(`Symbol Bootstrap preset file '${file}' created. Keep this safe!`);
        if (network === Network.mainnet)
            console.log(
                `Once the Symbol network launches, you will be able run your Symbol Node using Symbol Bootstrap and this custom preset file. Read more at https://docs.symbolplatform.com/guides/network/using-symbol-bootstrap.html`,
            );
        else {
            console.log(
                `You are able run your Symbol Node using Symbol Bootstrap and this custom preset file. Read more at https://docs.symbolplatform.com/guides/network/using-symbol-bootstrap.html`,
            );
        }
        console.log();
        console.log('You can edit this file to further customize it.');
        console.log();
        console.log('To run your node use:');
        console.log(`$ symbol-bootstrap start -p ${network} -a ${assembly} -c ${file}`);

        if (existsSync(targetZip)) {
            console.log();
            console.log();
            console.log(`Alternately, you can copy the zip file ${targetZip} into your node machine, unzip it and run:`);
            console.log();
            console.log(`$ symbol-bootstrap start -p ${network} -a ${assembly}`);
        }

        console.log();
        console.log('To link your accounts use:');
        console.log(`$ symbol-bootstrap link --useKnownRestGateways`);
        if (rewardProgram == RewardProgram.SuperNode) {
            console.log();
            console.log('To enrol to the supernode program, run:');
            console.log(`$ symbol-bootstrap enrolRewardProgram  --useKnownRestGateways`);
        }
        console.log();
        console.log('Symbol bootstrap will ask for password or you can provide them using the  --password ***** parameter');
    }

    private async resolveAccounts(importMode: ImportType, networkType: NetworkType, voting: boolean): Promise<ProvidedAccounts> {
        switch (importMode) {
            case ImportType.OPTIN_PAPER_WALLET: {
                const derivedAccount = await this.resolveDerivedAccount(networkType, true);
                return await this.resolveAllAccount(networkType, derivedAccount, voting);
            }
            case ImportType.SYMBOL_PAPER_WALLET: {
                const derivedAccount = await this.resolveDerivedAccount(networkType, false);
                return await this.resolveAllAccount(networkType, derivedAccount, voting);
            }
            case ImportType.PRIVATE_KEYS: {
                return await this.resolveAllAccount(networkType, undefined, voting);
            }
        }
    }

    private async resolveAllAccount(
        networkType: NetworkType,
        derivedAccount: DerivedAccount | undefined,
        voting: boolean,
    ): Promise<ProvidedAccounts> {
        return {
            seeded: true,
            main: derivedAccount ? derivedAccount.account : await this.resolveAccount(networkType, derivedAccount, KeyName.Main, 0),
            vrf: await this.resolveAccount(networkType, derivedAccount, KeyName.VRF, 1),
            voting: voting ? await this.resolveAccount(networkType, derivedAccount, KeyName.Voting, 2) : undefined,
            remote: await this.resolveAccount(networkType, derivedAccount, KeyName.Remote, 3),
            transport: await this.resolveAccount(networkType, derivedAccount, KeyName.Transport, 4),
        };
    }

    public async resolveAccount(
        networkType: NetworkType,
        derivedAccount: DerivedAccount | undefined,
        keyName: KeyName,
        changeIndex: number,
    ): Promise<Account> {
        const keyCreationChoices = [
            { name: 'Generating a brand generated account', value: 'generate' },
            { name: 'Entering a private key', value: 'manual' },
        ];
        if (derivedAccount && !derivedAccount.optinMode) {
            keyCreationChoices.push({ name: 'Derived from Symbol Paper Wallet seed', value: 'seed' });
        }
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
            console.log(`Using account ${account.address.pretty()} for ${keyName} key. ${message}`);
            return account;
        };
        if (keyCreationMode == 'generate') {
            return log(Account.generateNewAccount(networkType), 'It will be stored in your custom preset. Keep file safe!');
        }
        if (keyCreationMode == 'seed' && derivedAccount) {
            const seedAccount = Wizard.toAccountFromMnemonicPhrase(
                derivedAccount.mnemonicPassPhrase,
                networkType,
                derivedAccount.optinMode,
                derivedAccount.accountIndex,
                changeIndex,
            );
            return log(
                Account.createFromPrivateKey(seedAccount.privateKey, networkType),
                'It will be stored in your custom preset. Can be derived from the paper wallet if lost!',
            );
        }

        // manual
        const account = await Wizard.resolveAccount(networkType, keyName);
        return log(account, 'It will be stored in your custom preset. You can recreate the account by providing the private key again!');
    }

    public static async resolveAccount(networkType: NetworkType, keyName: KeyName): Promise<Account> {
        while (true) {
            const responses = await prompt([
                {
                    name: 'value',
                    message: `Enter the 64 HEX private key of the ${keyName} account.`,
                    type: 'password',
                    mask: '*',
                    validate: CommandUtils.isValidPrivateKey,
                },
            ]);
            const privateKey = responses.value === '' ? undefined : responses.value;
            if (!privateKey) {
                console.log('Please provide the private key.');
            } else {
                const enteredAccount = Account.createFromPrivateKey(privateKey, networkType);
                const { ok } = await prompt([
                    {
                        name: 'ok',
                        message: `Is this the expected address ${enteredAccount.address.pretty()} to used as ${keyName} account? `,
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
                        { name: 'Mainnet Node - DEMO ONLY!', value: Network.mainnet },
                        { name: 'Testnet Node', value: Network.testnet },
                        { name: 'Private Network', value: Network.privateNetwork },
                    ],
                },
            ]);
            return responses.network;
        }
        return providedNetwork;
    }

    public static async resolvePrivateKeySecurityMode(): Promise<PrivateKeySecurityMode> {
        const { mode } = await prompt([
            {
                name: 'mode',
                message: 'Select the type of security you want to use:',
                type: 'list',
                default: PrivateKeySecurityMode.PROMPT_MAIN_VOTING,
                choices: [
                    {
                        name:
                            'PROMPT_MAIN_VOTING: Bootstrap may ask for Main and Voting private keys when doing certificates and voting key file upgrades. Other keys are encrypted.',
                        value: PrivateKeySecurityMode.PROMPT_MAIN_VOTING,
                    },
                    {
                        name:
                            'PROMPT_MAIN: Bootstrap may ask for the Main private key when doing certificates upgrades. Other keys are encrypted.',
                        value: PrivateKeySecurityMode.PROMPT_MAIN,
                    },
                    { name: 'ENCRYPT: All keys are encrypted, only password would be asked', value: PrivateKeySecurityMode.ENCRYPT },
                ],
            },
        ]);
        return mode;
    }

    public static async resolveAssembly(preset: Preset): Promise<string> {
        console.log('Select the assembly to be created:\n');
        const responses = await prompt([
            {
                name: 'assembly',
                message: 'Select an assembly:',
                type: 'list',
                default: assemblies[preset][0].value,
                choices: assemblies[preset].map(({ value, description }) => ({
                    value: value,
                    name: description,
                })),
            },
        ]);
        return responses.assembly;
    }

    public static async resolveImportMode(): Promise<ImportType> {
        console.log('It is highly recommended to use a Paper Wallet so all your keys kept there');
        const responses = await prompt([
            {
                name: 'mode',
                message: 'How do you want to import your accounts?',
                type: 'list',
                default: ImportType.OPTIN_PAPER_WALLET,
                choices: [
                    {
                        value: ImportType.OPTIN_PAPER_WALLET,
                        name: 'OptIn Paper Wallet (Pre-Launch): Only the main private key can be restored. Other keys will be generated.',
                    },
                    {
                        value: ImportType.SYMBOL_PAPER_WALLET,
                        name: 'Symbol Paper Wallet (Post-Launch): The main and secondary keys can be restored from the paper.',
                    },
                    {
                        value: ImportType.PRIVATE_KEYS,
                        name: 'Private Keys: The private Keys will be generated or entered.',
                    },
                ],
            },
        ]);
        return responses.mode;
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
            options: [Network.mainnet, Network.testnet, Network.privateNetwork],
        }) as IOptionFlag<Network | undefined>;
    }

    public static isValidPhrase(input: string): boolean | string {
        const words = input.trim().split(' ').length;
        return words === 24 ? true : `Invalid phrase. It must have 24 words but got ${words}.`;
    }

    async resolveDerivedAccount(networkType: NetworkType, optinMode: boolean): Promise<DerivedAccount> {
        try {
            console.log(
                'To generate the keys, enter the 24 words of the mnemonic phrase created when you opted in.\nYou can find them in the Paper Wallet. They will not be stored anywhere by this tool.\n',
            );
            let lastEnteredPhrase = '';
            while (true) {
                const phraseResponse = await prompt([
                    {
                        name: 'value',
                        message: `Mnemonic Phrase for you main account.`,
                        type: 'input',
                        default: lastEnteredPhrase || undefined,
                        validate: (input) => Wizard.isValidPhrase(input),
                    },
                ]);
                lastEnteredPhrase = phraseResponse.value.trim();
                const mnemonicPassPhrase = new MnemonicPassPhrase(lastEnteredPhrase);
                const derivedAccounts = this.findDerivedAccounts(mnemonicPassPhrase, networkType, optinMode, undefined, 0);

                const choices = derivedAccounts.map((derivedAccounts) => ({
                    value: derivedAccounts.account.address.plain(),
                    name: derivedAccounts.account.address.pretty(),
                }));
                choices.push({
                    value: 'none',
                    name: 'None of the above. Re-enter phrase',
                });
                const accountResponse = await prompt([
                    {
                        name: 'accountAddress',
                        message: 'Select an account:',
                        type: 'list',
                        default: choices[0].value,
                        choices: choices,
                    },
                ]);
                const derivedAccount = derivedAccounts.find(
                    (derivedAccount) => derivedAccount.account.address.plain() == accountResponse.accountAddress,
                );
                if (derivedAccount) {
                    return derivedAccount;
                }
            }
        } catch (e) {
            throw new Error(`Symbol account cannot be created from phrase: ${e.message}`);
        }
    }

    private findDerivedAccounts(
        mnemonicPassPhrase: MnemonicPassPhrase,
        networkType: NetworkType,
        optinMode: boolean,
        expectedAccountIndex: number | undefined,
        expectedChangeIndex: number | undefined,
    ): DerivedAccount[] {
        const accountIndexes: number[] = expectedAccountIndex === undefined ? Array.from(Array(20).keys()) : [expectedAccountIndex];
        const changeIndexes: number[] = expectedChangeIndex === undefined ? Array.from(Array(20).keys()) : [expectedChangeIndex];

        const derivedAccounts: DerivedAccount[] = [];
        for (const accountIndex of accountIndexes) {
            for (const changeIndex of changeIndexes) {
                const account = Wizard.toAccountFromMnemonicPhrase(mnemonicPassPhrase, networkType, optinMode, accountIndex, changeIndex);
                derivedAccounts.push({ networkType, optinMode, account, accountIndex, changeIndex, mnemonicPassPhrase });
            }
        }
        return derivedAccounts;
    }

    public static toAccountFromMnemonicPhrase(
        mnemonicPassPhrase: MnemonicPassPhrase,
        networkType: NetworkType,
        optinMode: boolean,
        accountIndex: number,
        changeIndex: number,
    ): Account {
        const coinIndex = networkType === NetworkType.MAIN_NET ? '4343' : '1';
        const mnemonicSeed = mnemonicPassPhrase.toSeed().toString('hex');
        const seedNetwork = optinMode ? SeedNetwork.BITCOIN : SeedNetwork.SYMBOL;
        const extendedKey = ExtendedKey.createFromSeed(mnemonicSeed, seedNetwork);
        const wallet = new Wallet(extendedKey);
        const path = `m/44'/${coinIndex}'/${accountIndex}'/${changeIndex}'/0'`;
        const privateKey = wallet.getChildAccountPrivateKey(path);
        return Account.createFromPrivateKey(privateKey, networkType);
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
        const valid = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(
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
    public static async resolveFriendlyName(): Promise<string> {
        const { friendlyName } = await prompt([
            {
                name: 'friendlyName',
                message: `Enter the friendly name of your node.`,
                type: 'input',
                validate: Wizard.isValidFriendlyName,
            },
        ]);
        return friendlyName;
    }
}
