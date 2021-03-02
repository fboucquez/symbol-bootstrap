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

import { expect } from '@oclif/test';
import { readFileSync } from 'fs';
import 'mocha';
import { VotingUtils } from '../../src/service/VotingUtils';

describe('VotingUtils', () => {
    function assertVotingKey(testFile: string, privateKey: string, votingKeyStartEpoch: number, votingKeyEndEpoch: number) {
        const headerSize = 64 + 16;
        //This files have been created from the original catapult tools's votingkey
        const expectedVotingKeyFile = new Uint8Array(readFileSync(testFile));
        const votingKeyFile = VotingUtils.createVotingFile(privateKey, votingKeyStartEpoch, votingKeyEndEpoch);
        expect(votingKeyFile.length).eq(expectedVotingKeyFile.length);
        const header = votingKeyFile.subarray(0, headerSize);
        const expectedHeader = expectedVotingKeyFile.subarray(0, headerSize);
        // expect(Convert.uint8ToHex(header)).deep.eq(Convert.uint8ToHex(expectedHeader));
        expect(header).deep.eq(expectedHeader);
    }

    it('createVotingFile voting key 1', async () => {
        // 114 s
        const votingKeyStartEpoch = 5;
        const votingKeyEndEpoch = 10;
        const privateKey = 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1';
        const testFile = './test/votingkeys/private_key_tree1.dat';
        assertVotingKey(testFile, privateKey, votingKeyStartEpoch, votingKeyEndEpoch);
    });

    it.skip('createVotingFile voting key 2', async () => {
        // 4 Minutes 25 seconds
        // TOO SLOW! I had to disable it.
        const votingKeyStartEpoch = 1;
        const votingKeyEndEpoch = 26280;
        const privateKey = 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1';
        const testFile = './test/votingkeys/private_key_tree2.dat';
        assertVotingKey(testFile, privateKey, votingKeyStartEpoch, votingKeyEndEpoch);
    });

    it('createVotingFile voting key 3', async () => {
        // 50 ms
        const votingKeyStartEpoch = 10;
        const votingKeyEndEpoch = 10;
        const privateKey = 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1';
        const testFile = './test/votingkeys/private_key_tree3.dat';
        assertVotingKey(testFile, privateKey, votingKeyStartEpoch, votingKeyEndEpoch);
    });

    it('createVotingFile voting key 4', async () => {
        // 10 seconds
        const votingKeyStartEpoch = 1;
        const votingKeyEndEpoch = 1000;
        const privateKey = 'EFE3F0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1';
        const testFile = './test/votingkeys/private_key_tree4.dat';
        assertVotingKey(testFile, privateKey, votingKeyStartEpoch, votingKeyEndEpoch);
    });

    it('createVotingFile voting key 5', async () => {
        // 1 minutes 41 seconds PRETTY SLOW!!!
        const votingKeyStartEpoch = 1;
        const votingKeyEndEpoch = 10000;
        const privateKey = 'AAAAF0EF0AB368B8D7AC194D52A8CCFA2D5050B80B9C76E4D2F4D4BF2CD461C1';
        const testFile = './test/votingkeys/private_key_tree5.dat';
        assertVotingKey(testFile, privateKey, votingKeyStartEpoch, votingKeyEndEpoch);
    });
});
