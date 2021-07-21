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
import { Account, Address, NetworkType, SignedTransaction, Transaction } from 'symbol-sdk';
import { CertificatePair, KeyName } from '../';

export interface AccountResolver {
    resolveAccount(
        networkType: NetworkType,
        account: CertificatePair | undefined,
        keyName: KeyName,
        nodeName: string,
        operationDescription: string,
        generateErrorMessage: string | undefined,
    ): Promise<Account>;

    shouldAnnounce(transaction: Transaction, signedTransaction: SignedTransaction, transactionDescription: string): Promise<boolean>;

    resolveCosigners(networkType: NetworkType, expectedAddresses: Address[], minApproval: number): Promise<Account[]>;
}

export class DefaultAccountResolver implements AccountResolver {
    async shouldAnnounce(): Promise<boolean> {
        return true;
    }
    resolveCosigners(): Promise<Account[]> {
        throw new Error('Cosigners not implemented');
    }
    async resolveAccount(
        networkType: NetworkType,
        account: CertificatePair | undefined,
        keyName: KeyName,
        nodeName: string,
        operationDescription: string,
        generateErrorMessage: string | undefined,
    ): Promise<Account> {
        if (!account) {
            if (generateErrorMessage) {
                throw new Error(generateErrorMessage);
            }
            return this.generateNewAccount(networkType);
        }
        if (account?.privateKey) {
            return Account.createFromPrivateKey(account.privateKey, networkType);
        }
        throw new Error('Private key not provided');
    }

    generateNewAccount(networkType: NetworkType): Account {
        return Account.generateNewAccount(networkType);
    }
}
