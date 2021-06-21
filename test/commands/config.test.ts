/*
 * Copyright 2020 NEM
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

import { expect, test } from '@oclif/test';
import { Account, NetworkType } from 'symbol-sdk';
import { ConfigLoader } from '../../src';

describe('config', () => {
    it('should be valid account', function () {
        const privateKey = 'AAA'.padStart(64, '0');
        expect(ConfigLoader.toConfigFromAccount(Account.createFromPrivateKey(privateKey, NetworkType.PRIVATE_TEST))).deep.eq({
            address: 'VB26Y6PDUYEVDVWRWHGEGSZ43FT6726XOFU2FJQ',
            publicKey: '512C97A7527CD49CBD8EDB6A0707EC239A9F24DB2EFFF2272A92BFD8F987D9B3',
            privateKey: privateKey,
        });
    });
    test.stdout()
        .command(['config', '-p', 'dualCurrency', '-r', '--password', '1111'])
        .it('runs config', (ctx) => {
            console.log(ctx.stdout);
        });
});

describe('config with opt in', () => {
    test.stdout()
        .command(['config', '-p', 'dualCurrency', '-r', '-c', './test/custom_preset.yml', '--noPassword'])
        .it('runs config', (ctx) => {
            console.log(ctx.stdout);
        });
});
