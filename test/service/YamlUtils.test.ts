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
import * as _ from 'lodash';
import 'mocha';
import { it } from 'mocha';
import { Account, NetworkType } from 'symbol-sdk';
import { ConfigurationUtils, Utils, YamlUtils } from '../../src';
import { ConfigAccount } from '../../src/model';
import { CryptoUtils } from '../../src/service';

describe('YamlUtils', () => {
    it('YamlUtils generate random', async () => {
        const networkType = NetworkType.TEST_NET;

        const balances: (ConfigAccount & { balance: number })[] = [];

        for (let i = 0; i < 10; i++) {
            console.log();
            const account = ConfigurationUtils.toConfigAccount(Account.generateNewAccount(networkType));
            balances.push({ ...account, balance: 1000000 });
        }
        console.log(YamlUtils.toYaml({ nemesisBalances: balances }));
    });

    it('YamlUtils.loadYaml', async () => {
        expect(CryptoUtils.encryptedCount(YamlUtils.loadYaml('test/encrypted.yml', '1234'))).to.be.eq(0);

        try {
            YamlUtils.loadYaml('test/encrypted.yml', 'abc');
            expect(1).eq(0);
        } catch (e) {
            expect(Utils.getMessage(e)).eq('Password is too short. It should have at least 4 characters!');
        }

        try {
            YamlUtils.loadYaml('test/encrypted.yml', 'abcd');
            expect(1).eq(0);
        } catch (e) {
            expect(Utils.getMessage(e)).eq('Cannot decrypt file test/encrypted.yml. Have you used the right password?');
        }

        try {
            YamlUtils.loadYaml('test/encrypted.yml', '');
            expect(1).eq(0);
        } catch (e) {
            expect(Utils.getMessage(e)).eq(
                'File test/encrypted.yml seems to be encrypted but no password has been provided. Have you entered the right password?',
            );
        }

        try {
            YamlUtils.loadYaml('test/encrypted.yml', undefined);
            expect(1).eq(0);
        } catch (e) {
            expect(Utils.getMessage(e)).eq(
                'File test/encrypted.yml seems to be encrypted but no password has been provided. Have you entered the right password?',
            );
        }

        expect(CryptoUtils.encryptedCount(YamlUtils.loadYaml('test/encrypted.yml', false))).to.be.eq(6);
    });

    it('mergeTest', async () => {
        const a = { a: 1, list: ['1', '1', '3'], c: 'A', beneficiaryAddress: 'abc' };
        const b = { a: undefined, c: 'B' };
        const c = { list: ['a', 'b'], a: undefined, c: 'C', beneficiaryAddress: '' };
        const expected = {
            a: 1,
            beneficiaryAddress: '',
            c: 'C',
            list: ['a', 'b', '3'],
        };

        expect(_.merge(a, b, c)).deep.equals(expected);

        expect(_.merge(a, b, c)).deep.equals(expected);
    });
});
