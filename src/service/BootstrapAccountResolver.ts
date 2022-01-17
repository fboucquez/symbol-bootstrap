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
import { Account, NetworkType, PublicAccount } from 'symbol-sdk';
import { AccountResolver, CertificatePair, CommandUtils, KeyName, KnownError, Logger } from '../';

/**
 * Prompt ready implementation of the account resolver.
 */
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

        if (account.privateKey) {
            return Account.createFromPrivateKey(account.privateKey, networkType);
        }

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
                    validate: CommandUtils.isValidPrivateKey,
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
                    return enteredAccount;
                }
            }
        }
    }
}
