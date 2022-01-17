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

import { expect } from 'chai';
import { statSync } from 'fs';
import 'mocha';
import { it } from 'mocha';
import { BootstrapUtils, FileSystemService, LoggerFactory, LogType } from '../../src';
import nock = require('nock');
const logger = LoggerFactory.getLogger(LogType.Silent);
const fileSystemService = new FileSystemService(logger);
describe('FileSystemService', () => {
    it('FileSystemService.download', async () => {
        const url = 'https://myserver.get';

        fileSystemService.deleteFile('boat.png');

        const expectedSize = 43970;
        async function download(): Promise<boolean> {
            nock(url).get('/boat.png').replyWithFile(200, 'test/boat.png', { 'content-length': expectedSize.toString() });
            const result = await fileSystemService.download(url + '/boat.png', 'boat.png');
            expect(statSync('boat.png').size).eq(expectedSize);
            return result.downloaded;
        }
        expect(await download()).eq(true);
        expect(await download()).eq(false);
        expect(await download()).eq(false);
        await BootstrapUtils.writeTextFile('boat.png', 'abc');
        expect(statSync('boat.png').size).not.eq(expectedSize);
        expect(await download()).eq(true);
        expect(await download()).eq(false);
    });

    it('FileSystemService.download when invalid', async () => {
        fileSystemService.deleteFile('boat.png');
        try {
            const url = 'https://myserver.get';
            nock(url).get('/boat.png').reply(404);
            await fileSystemService.download(url + '/boat.png', 'boat.png');
            expect(false).eq(true);
        } catch (e) {
            expect(e.message).eq('Server responded with 404');
        }
    });
});
