/*
 * Copyright 2022 Fernando Boucquez
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

import { prompt } from 'inquirer';
import {
    Address,
    MultisigAccountInfo,
    MultisigAccountModificationTransaction,
    NetworkType,
    Transaction,
    UnresolvedAddress,
} from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigPreset } from '../model';
import { AccountResolver } from './AccountResolver';
import { AnnounceService, TransactionFactory, TransactionFactoryParams } from './AnnounceService';
import { BootstrapAccountResolver } from './BootstrapAccountResolver';
import { ConfigLoader } from './ConfigLoader';
import { Constants } from './Constants';
import { TransactionUtils } from './TransactionUtils';
import { Password } from './YamlUtils';

/**
 * params necessary to announce multisig account modification transaction to network.
 */
export type ModifyMultisigParams = {
    target: string;
    password?: Password;
    url: string;
    maxFee?: number;
    useKnownRestGateways: boolean;
    ready?: boolean;
    customPreset?: string;
    minRemovalDelta?: number;
    minApprovalDelta?: number;
    addressAdditions?: string;
    addressDeletions?: string;
    serviceProviderPublicKey?: string;
    accountResolver?: AccountResolver;
};

export class ModifyMultisigService implements TransactionFactory {
    public static readonly defaultParams: ModifyMultisigParams = {
        target: Constants.defaultTargetFolder,
        useKnownRestGateways: false,
        ready: false,
        url: 'http://localhost:3000',
        maxFee: 100000,
    };

    private readonly configLoader: ConfigLoader;

    constructor(private readonly logger: Logger, protected readonly params: ModifyMultisigParams) {
        this.configLoader = new ConfigLoader(logger);
    }

    public async run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
        const customPreset = this.configLoader.loadCustomPreset(this.params.customPreset, this.params.password);
        const accountResolver = this.params.accountResolver || new BootstrapAccountResolver(this.logger);
        await new AnnounceService(this.logger, accountResolver).announce(
            this.params.url,
            this.params.maxFee,
            this.params.useKnownRestGateways,
            this.params.ready,
            this.params.target,
            this.configLoader.mergePresets(presetData, customPreset),
            addresses,
            this,
            'some',
            this.params.serviceProviderPublicKey,
        );
    }

    public async createTransactions({ presetData, deadline, maxFee, mainAccount }: TransactionFactoryParams): Promise<Transaction[]> {
        const networkType = presetData.networkType;

        const addressAdditions = await this.resolveAddressAdditions(networkType, this.params.addressAdditions);
        const addressDeletions = await this.resolveAddressDeletions(networkType, this.params.addressDeletions);
        const minApprovalDelta = await this.resolveMinApprovalDelta(this.params.minApprovalDelta);
        const minRemovalDelta = await this.resolveMinRemovalDelta(this.params.minRemovalDelta);

        const url = this.params.url.replace(/\/$/, '');
        const repositoryFactory = await TransactionUtils.getRepositoryFactory(
            this.logger,
            presetData,
            this.params.useKnownRestGateways ? undefined : url,
        );
        const multisigInfo = await TransactionUtils.getMultisigAccount(repositoryFactory, mainAccount.address);
        this.validateParams(addressAdditions, addressDeletions, minRemovalDelta, minApprovalDelta, multisigInfo);

        this.logger.info(
            `Creating multisig account modification transaction [addressAdditions: "${addressAdditions
                ?.map((a) => a.plain())
                .join(' , ')}", addressDeletions: "${addressDeletions
                ?.map((a) => a.plain())
                .join(' , ')}", minApprovalDelta: ${minApprovalDelta}, minRemovalDelta: ${minRemovalDelta}]`,
        );
        const multisigAccountModificationTransaction = MultisigAccountModificationTransaction.create(
            deadline,
            minApprovalDelta,
            minRemovalDelta,
            addressAdditions ? addressAdditions : [],
            addressDeletions ? addressDeletions : [],
            networkType,
            maxFee,
        );

        return [multisigAccountModificationTransaction];
    }

    public async resolveMinRemovalDelta(delta?: number): Promise<number> {
        return this.resolveDelta('minRemovalDelta', 'Minimum removal delta:', delta);
    }

    public async resolveMinApprovalDelta(delta?: number): Promise<number> {
        return this.resolveDelta('minApprovalDelta', 'Minimum approval delta:', delta);
    }

    public async resolveDelta(name: string, message: string, delta?: number): Promise<number> {
        return delta !== undefined
            ? delta
            : (
                  await prompt([
                      {
                          name,
                          message,
                          type: 'number',
                          default: 0,
                      },
                  ])
              )[name];
    }

    public async resolveAddressAdditions(networkType: NetworkType, cosigners?: string): Promise<UnresolvedAddress[]> {
        return this.resolveCosigners(
            networkType,
            'addressAdditions',
            'Enter the cosignatory addresses to add (separated by a comma) <Press enter to skip>:',
            cosigners,
        );
    }

    public async resolveAddressDeletions(networkType: NetworkType, cosigners?: string): Promise<UnresolvedAddress[]> {
        return this.resolveCosigners(
            networkType,
            'addressDeletions',
            'Enter the cosignatory addresses to remove (separated by a comma) <Press enter to skip>:',
            cosigners,
        );
    }

    public async resolveCosigners(
        networkType: NetworkType,
        name: string,
        message: string,
        cosigners?: string,
    ): Promise<UnresolvedAddress[]> {
        const resolution =
            cosigners !== undefined
                ? cosigners
                : (
                      await prompt([
                          {
                              name,
                              message,
                          },
                      ])
                  )[name];
        if (!resolution) {
            return [];
        }
        const cosignatoryAddresses = resolution.split(',');
        return this.toAddresses(networkType, cosignatoryAddresses);
    }

    private toAddresses(networkType: NetworkType, addresses?: string[]): UnresolvedAddress[] {
        return (
            addresses?.map((addressString) => {
                return this.toAddress(addressString.trim(), networkType);
            }) || []
        );
    }

    private toAddress(addressString: string, networkType: NetworkType): Address {
        if (!Address.isValidRawAddress(addressString)) {
            throw new Error(`Address ${addressString} is not valid!`);
        }
        const address = Address.createFromRawAddress(addressString);
        if (address.networkType !== networkType) {
            throw new Error(`Address ${addressString} invalid network type. Expected ${networkType} but got ${address.networkType}`);
        }
        return address;
    }

    protected validateParams(
        addressAdditions?: UnresolvedAddress[],
        addressDeletions?: UnresolvedAddress[],
        minRemovalDelta?: number,
        minApprovalDelta?: number,
        currentMultisigInfo?: MultisigAccountInfo,
    ): void {
        // calculate new min approval
        const newMinApproval = currentMultisigInfo ? currentMultisigInfo.minApproval + (minApprovalDelta || 0) : minApprovalDelta || 0;

        // calculate new min approval
        const newMinRemoval = currentMultisigInfo ? currentMultisigInfo.minRemoval + (minRemovalDelta || 0) : minRemovalDelta || 0;

        // calculate the delta of added cosigners
        const numberOfAddedCosigners = (addressAdditions?.length || 0) - (addressDeletions?.length || 0);

        const newCosignatoryNumber = currentMultisigInfo
            ? currentMultisigInfo.cosignatoryAddresses.length + numberOfAddedCosigners
            : numberOfAddedCosigners;

        for (const addressToAdd of addressAdditions || []) {
            if (currentMultisigInfo?.cosignatoryAddresses.some((ca) => ca && ca.plain() === addressToAdd.plain())) {
                throw new Error(`Cannot add cosignatory! ${addressToAdd.plain()} is already a cosignatory!`);
            }
        }

        for (const addressToRemove of addressDeletions || []) {
            if (!currentMultisigInfo?.cosignatoryAddresses.some((ca) => ca && ca.plain() === addressToRemove.plain())) {
                throw new Error(`Cannot remove cosignatory! ${addressToRemove.plain()} is not an actual cosignatory!`);
            }
        }

        if (newCosignatoryNumber < newMinApproval) {
            throw new Error(
                `There are ${
                    newMinApproval - newCosignatoryNumber
                } more required cosignatories than available cosignatories for min. approval. Please add cosignatories or reduce the min. approval delta.`,
            );
        }

        if (newCosignatoryNumber < newMinRemoval) {
            throw new Error(
                `There are ${
                    newMinRemoval - newCosignatoryNumber
                }  more required cosignatories than available cosignatories for min removal. Please add cosignatories or reduce the min. removal delta.`,
            );
        }

        if (newCosignatoryNumber > 0 && (newMinApproval == 0 || newMinRemoval == 0)) {
            throw new Error(
                `Minimum approval and/or minimum removal cannot be set to 0 while there are ${newCosignatoryNumber} cosignatories in your list.`,
            );
        }
    }
}
