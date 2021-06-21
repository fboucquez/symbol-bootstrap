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

import { expect } from 'chai';
import { compareSync, Result } from 'dir-compare';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import 'mocha';
import { join } from 'path';
import { BootstrapUtils, LoggerFactory, LogType } from 'symbol-bootstrap-core';
import { LocalFileKeyStore, NetworkService, NetworkUtils } from 'symbol-network-core';
import { InitService } from '../../src';
import { StdUtils } from './StdUtils';

const logger = LoggerFactory.getLogger(LogType.Console);

const toKey = (prefix: string, keySize = 64): string => {
    return prefix.padStart(keySize, '0');
};

async function compareDire(expectedTarget: string, target: string) {
    if (!existsSync(target)) {
        throw new Error(`Target ${target} must exist!!!`);
    }
    if (!existsSync(expectedTarget)) {
        await BootstrapUtils.copyDir(target, expectedTarget);
    }
    const compareResult: Result = compareSync(target, expectedTarget, {
        compareSize: true,
        compareContent: true,
        skipEmptyDirs: true,
        excludeFilter: '*.pem',
    });
    const differences = compareResult.diffSet?.filter((s) => s.state != 'equal') || [];
    const report = BootstrapUtils.toYaml(differences);
    const patch = false;
    const differentContents = differences
        .filter(
            (d) =>
                d.state == 'distinct' &&
                (d.reason == 'different-content' || d.reason == 'different-size') &&
                d.type1 == 'file' &&
                d.type2 == 'file' &&
                d.path1 &&
                d.path2,
        )
        .filter((d) => {
            const path1 = join(d.path1!, d.name1!);
            const path2 = join(d.path2!, d.name2!);

            if (patch) {
                copyFileSync(path1, path2);
            }
            return !path1.endsWith('.dat') && !path1.endsWith('.proof');
        })
        .map((d) => {
            console.log(d);
            const path1 = join(d.path1!, d.name1!);
            const path2 = join(d.path2!, d.name2!);

            const content1 = readFileSync(path1, { encoding: 'utf-8' });
            const content2 = readFileSync(path2, { encoding: 'utf-8' });
            return { ...d, content1, content2 };
        });

    if (differentContents.length) {
        const diff = differentContents.reduce(
            (r, d) => {
                return {
                    content1: `${r.content1}${join(d.path1!, d.name1!)}\n\n${d.content1}\n\n\n`,
                    content2: `${r.content2}${join(d.path2!, d.name2!)}\n\n${d.content2}\n\n\n`,
                };
            },
            {
                content1: '',
                content2: '',
            },
        );
        expect(diff.content1, `there are differences between folders!. Report:\n\n${report}`).equals(diff.content2);
    } else {
        expect(compareResult.differences, `there are differences between folders!. Report:\n\n${report}`).equals(0);
    }
}

describe('Init', () => {
    it.skip('network1 init', async () => {
        // FAILING IN TRAVIS FOR SOME REASON!
        const target = 'target/network1';
        await BootstrapUtils.deleteFolder(logger, target);
        await BootstrapUtils.mkdir(target);

        // assembly
        StdUtils.in([
            '\n',
            '\n',
            'mytest.com\n',
            'testprefix\n',
            StdUtils.keys.down,
            '\n',
            'My Private Test Network\n',
            `${toKey('A')}`,
            '\n',
            '1626575785\n',
            'pirate\n',
            'gold\n',
            `${toKey('B')}`,
            '\n',
            `${toKey('C')}`,
            '\n',
            'Y\n',
            `${toKey('D')}`,
            '\n',
            '\n',
            `${toKey('E')}\n`,
            `${toKey('F')}\n`,
            `${toKey('AA')}\n`,
            `N\n`,
            `\n`,
            // `\n`,
            StdUtils.keys.down,
            StdUtils.keys.down,
            `\n`,
            '2',
            `\n`,
            `\n`,
            `\n`,
            `\n`,
            `Y\n`,
            //Second node
            StdUtils.keys.down,
            StdUtils.keys.down,
            StdUtils.keys.down,
            StdUtils.keys.down,
            StdUtils.keys.down,
            `\n`,
            '1',
            `\n`,
            `\n`,
            `\n`,
            `\n`,
            `N\n`, //finish
        ]);

        await new InitService(logger, target, {
            ready: true,
            showPrivateKeys: true,
            noPassword: true,
            additionalNetworkPreset: {
                peersP2PListLimit: 10000,
                peersApiListLimit: 10000,
                restDeploymentToolVersion: '1.0.8',
                restDeploymentToolLastUpdatedDate: '2021-07-05',
            },
        }).execute();
        await compareDire('test/expectedTargets/network1-after-init', target);
    });

    it('network1 configure', async () => {
        const target = 'target/network1';
        await BootstrapUtils.deleteFolder(logger, target);
        await BootstrapUtils.mkdir(target);

        const service = new NetworkService(logger, target);
        await BootstrapUtils.copyDir('test/expectedTargets/network1-after-init', target);
        copyFileSync('test/expectedTargets/network-1-key-store.yml', join(target, NetworkUtils.KEY_STORE_FILE));
        const keyStore = new LocalFileKeyStore(undefined, true, target);
        await service.expandNodes(keyStore);
        await service.generateNemesis(keyStore, { regenerate: false, composeUser: '1000:1000' });
        await service.updateNodes(keyStore, {
            offline: true,
            nodePassword: undefined,
            composeUser: '1000:1000',
        });

        await compareDire('test/expectedTargets/network1-end', target);
    });
});
