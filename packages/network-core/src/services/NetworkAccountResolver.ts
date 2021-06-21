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

import { AccountResolver, CertificatePair, KeyName, Logger } from 'symbol-bootstrap-core';
import { Account, NetworkType } from 'symbol-sdk';
import { NodeInformation } from '../model';
import { KeyStore } from './KeyStore';

export class NetworkAccountResolver implements AccountResolver {
    constructor(private readonly logger: Logger, private readonly node: NodeInformation, private readonly keyStore: KeyStore) {}

    public async shouldAnnounce(): Promise<boolean> {
        return true;
    }

    resolveCosigners(): Promise<Account[]> {
        throw new Error('Method not implemented.');
    }

    public async resolveAccount(
        networkType: NetworkType,
        account: CertificatePair | undefined,
        keyName: KeyName,
        nodeName: string,
        operationDescription: string,
    ): Promise<Account> {
        if (account && account.privateKey) {
            return Account.createFromPrivateKey(account.privateKey, networkType);
        }

        this.logger.info(`Loading ${keyName} Key for ${nodeName} of ${this.node.number}. Operation ${operationDescription}`);
        const storedAccount = await this.keyStore.getNodeAccount(networkType, keyName, nodeName, this.node, true);

        if (account && storedAccount.publicKey != account?.publicKey) {
            throw new Error('Invalid public key!!');
        }
        return storedAccount;
    }
}
