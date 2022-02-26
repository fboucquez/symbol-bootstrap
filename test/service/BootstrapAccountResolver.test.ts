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

import { expect } from 'chai';
import { it } from 'mocha';
import { Account, NetworkType } from 'symbol-sdk';
import { BootstrapAccountResolver, KeyName, LoggerFactory, LogType, Utils } from '../../src';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { StdUtils } from '../utils/StdUtils';

describe('BootstrapAccountResolver', () => {
    const logger = LoggerFactory.getLogger(LogType.Silent);
    const networkType = NetworkType.TEST_NET;
    const resolver = new BootstrapAccountResolver(logger);
    const testAccount = Account.generateNewAccount(networkType);

    it('should resolveAccount when private key is provided', async () => {
        const account = await resolver.resolveAccount(
            networkType,
            {
                privateKey: testAccount.privateKey,
                publicKey: testAccount.publicKey,
            },
            KeyName.Main,
            'some node',
            'some description',
            undefined,
        );
        expect(account).to.be.deep.eq(testAccount);
    });

    it('should resolveAccount prompt private key when private key is provided', async () => {
        // first 2 are invalid, last one passes.
        StdUtils.in(['INVALID', '\n', testAccount.publicKey, '\n', testAccount.privateKey, '\n']);
        const account = await resolver.resolveAccount(
            networkType,
            {
                publicKey: testAccount.publicKey,
            },
            KeyName.Main,
            'some node',
            'some description',
            undefined,
        );
        expect(account).to.be.deep.eq(testAccount);
    });

    it('should resolveAccount generate account when no account is not provided', async () => {
        const account = await resolver.resolveAccount(networkType, undefined, KeyName.Main, 'some node', 'some description', undefined);
        expect(account).to.not.be.undefined;
        expect(account).to.be.not.deep.eq(testAccount);
    });

    it('should resolveAccount raise error when no account is not provided', async () => {
        try {
            await resolver.resolveAccount(networkType, undefined, KeyName.Main, 'some node', 'some description', 'DO NOT GENERATE');
            expect.fail('Should raise error!');
        } catch (e) {
            expect(Utils.getMessage(e)).to.be.eq('DO NOT GENERATE');
        }
    });
});
