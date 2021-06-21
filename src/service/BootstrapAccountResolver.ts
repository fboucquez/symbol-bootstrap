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
import { prompt } from 'inquirer';
import { Account, Address, NetworkType, PublicAccount, SignedTransaction, Transaction } from 'symbol-sdk';
import { AccountResolver, BootstrapUtils, CertificatePair, KeyName, KnownError, Logger } from '../';
export class BootstrapAccountResolver implements AccountResolver {
    constructor(private readonly logger: Logger) {}

    public async resolveAccount(
        networkType: NetworkType,
        account: CertificatePair | undefined,
        keyName: KeyName,
        nodeName: string,
        operationDescription: string,
        generateErrorMessage: string | undefined,
    ): Promise<Account> {
        if (!account) {
            if (generateErrorMessage) {
                throw new KnownError(generateErrorMessage);
            }
            this.logger.info(`Generating ${keyName} account...`);
            return Account.generateNewAccount(networkType);
        }

        if (!account.privateKey) {
            while (true) {
                this.logger.info('');
                this.logger.info(`${keyName} private key is required when ${operationDescription}.`);
                const address = PublicAccount.createFromPublicKey(account.publicKey, networkType).address.plain();
                const nodeDescription = nodeName === '' ? `of` : `of the Node's '${nodeName}'`;
                const responses = await prompt([
                    {
                        name: 'value',
                        message: `Enter the 64 HEX private key ${nodeDescription} ${keyName} account with Address: ${address} and Public Key: ${account.publicKey}:`,
                        type: 'password',
                        mask: '*',
                        validate: BootstrapUtils.isValidPrivateKey,
                    },
                ]);
                const privateKey = responses.value === '' ? undefined : responses.value.toUpperCase();
                if (!privateKey) {
                    this.logger.info('Please provide the private key.');
                } else {
                    const enteredAccount = Account.createFromPrivateKey(privateKey, networkType);
                    if (enteredAccount.publicKey.toUpperCase() !== account.publicKey.toUpperCase()) {
                        this.logger.info(
                            `Invalid private key. Expected address is ${address} but you provided the private key for address ${enteredAccount.address.plain()}.\n`,
                        );
                        this.logger.info(`Please re-enter private key.`);
                    } else {
                        account.privateKey = privateKey;
                        return Account.createFromPrivateKey(privateKey, networkType);
                    }
                }
            }
        }
        return Account.createFromPrivateKey(account.privateKey, networkType);
    }

    public async shouldAnnounce(
        transaction: Transaction,
        signedTransaction: SignedTransaction,
        transactionDescription: string,
    ): Promise<boolean> {
        return (
            await prompt([
                {
                    name: 'value',
                    message: `Do you want to announce ${transactionDescription}?`,
                    type: 'confirm',
                    default: true,
                },
            ])
        ).value;
    }

    public async resolveCosigners(networkType: NetworkType, expectedAddresses: Address[], minApproval: number): Promise<Account[]> {
        const providedAccounts: Account[] = [];
        const allowedAddresses = [...expectedAddresses];
        while (true) {
            this.logger.info('');
            const expectedDescription = allowedAddresses.map((address) => address.plain()).join(', ');
            const responses = await prompt([
                {
                    name: 'privateKey',
                    message: `Enter the 64 HEX private key of one of the addresses ${expectedDescription}. Already entered ${providedAccounts.length} out of ${minApproval} required cosigners.`,
                    type: 'password',
                    validate: BootstrapUtils.isValidPrivateKey,
                },
            ]);
            const privateKey = responses.privateKey;
            if (!privateKey) {
                this.logger.info('Please provide the private key....');
            } else {
                const account = Account.createFromPrivateKey(privateKey, networkType);
                const expectedAddress = allowedAddresses.find((address) => address.equals(account.address));
                if (!expectedAddress) {
                    this.logger.info('');
                    this.logger.info(
                        `Invalid private key. The entered private key has this ${account.address.plain()} address and it's not one of ${expectedDescription}. \n`,
                    );
                    this.logger.info(`Please re enter private key...`);
                } else {
                    allowedAddresses.splice(allowedAddresses.indexOf(expectedAddress), 1);
                    providedAccounts.push(account);
                    if (!allowedAddresses.length) {
                        this.logger.info('All cosigners have been entered.');
                        return providedAccounts;
                    }
                    if (providedAccounts.length == minApproval) {
                        this.logger.info(`Min Approval of ${minApproval} has been reached. Aggregate Complete transaction can be created.`);
                        return providedAccounts;
                    }
                    const { more } = await prompt([
                        {
                            name: 'more',
                            message: `Do you want to enter more cosigners?`,
                            type: 'confirm',
                            default: providedAccounts.length < minApproval,
                        },
                    ]);
                    if (!more) {
                        return providedAccounts;
                    } else {
                        this.logger.info('Please provide an additional private key....');
                    }
                }
            }
        }
    }
}
