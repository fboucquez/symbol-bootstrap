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
import { AsyncUtils, LoggerFactory, LogType } from '../../src';

const logger = LoggerFactory.getLogger(LogType.Silent);

describe('AsyncUtils', () => {
    it('sleep', async () => {
        const initial = Date.now();
        await AsyncUtils.sleep(200);
        const final = Date.now();
        expect(final - initial).gte(190);
    });

    it('poll finishes', async () => {
        let counter = 0;
        await AsyncUtils.poll(logger, async () => counter++ == 3, 100, 10);
        expect(counter).gte(3);
    });

    it('poll fails', async () => {
        let counter = 0;
        await AsyncUtils.poll(logger, async () => counter++ == 4, 21, 10);
        expect(counter).gte(2);
    });
});
