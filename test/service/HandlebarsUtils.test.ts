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
import { totalmem } from 'os';
import { HandlebarsUtils } from '../../src/service';

describe('HandlebarsUtils', () => {
    it('HandlebarsUtils.toAmount', async () => {
        expect(() => HandlebarsUtils.toAmount(12345678.9)).to.throw;
        expect(() => HandlebarsUtils.toAmount('12345678.9')).to.throw;
        expect(() => HandlebarsUtils.toAmount('abc')).to.throw;
        expect(() => HandlebarsUtils.toAmount('')).to.throw;
        expect(HandlebarsUtils.toAmount(12345678)).to.be.eq("12'345'678");
        expect(HandlebarsUtils.toAmount('12345678')).to.be.eq("12'345'678");
        expect(HandlebarsUtils.toAmount("12'3456'78")).to.be.eq("12'345'678");
    });

    it('HandlebarsUtils.computerMemory', async () => {
        const totalMemory = totalmem();
        expect(totalMemory).to.be.gt(1024 * 1024);
        expect(HandlebarsUtils.computerMemory(100)).to.be.eq(totalMemory);
        expect(HandlebarsUtils.computerMemory(50)).to.be.eq(totalMemory / 2);
    });

    it('HandlebarsUtils.toHex', async () => {
        expect(HandlebarsUtils.toHex("5E62990DCAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(HandlebarsUtils.toHex("0x5E62'990D'CAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(HandlebarsUtils.toHex('0x5E62990DCAC5BE8A')).to.be.eq("0x5E62'990D'CAC5'BE8A");
        expect(HandlebarsUtils.toHex("5E62'990D'CAC5'BE8A")).to.be.eq("0x5E62'990D'CAC5'BE8A");
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
