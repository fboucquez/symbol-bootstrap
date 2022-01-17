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
import { compareSync, Result } from 'dir-compare';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BootstrapUtils } from '../../src';

interface AssertFoldersParams {
    expectFolder: string;
    actualFolder: string;
    excludeFilter?: string;
}

export class FileSystemTestUtils {
    public static assertSameFolder({ expectFolder, actualFolder, excludeFilter }: AssertFoldersParams): void {
        BootstrapUtils.validateFolder(expectFolder);
        BootstrapUtils.validateFolder(actualFolder);
        const compareResult: Result = compareSync(expectFolder, actualFolder, {
            compareSize: true,
            compareContent: true,
            skipEmptyDirs: true,
            excludeFilter: excludeFilter,
        });
        const differences = compareResult.diffSet?.filter((s) => s.state != 'equal') || [];
        const report = BootstrapUtils.toYaml(differences);

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
            .map((d) => {
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
}
