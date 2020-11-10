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

import 'mocha';
import { ForgeCertificateService } from '../../src/service';
import { BootstrapUtils, CertificateService } from '../../src/service';
import { deepStrictEqual } from 'assert';

describe('CertificateService', () => {
    it('forge create certificate', async () => {
        await BootstrapUtils.deleteFolder('./target/unitTests');
        const service = new ForgeCertificateService({ target: './target/unitTests' });
        await service.run('peer-node');
    });

    it('getCertificates from output', async () => {
        const outputFile = `./test/certificates/output.txt`;
        const output = BootstrapUtils.loadFileAsText(outputFile);
        const certificates = CertificateService.getCertificates(output);
        deepStrictEqual(certificates, [
            {
                privateKey: '7B63F86AF5E33617C349832012F42FAC0102001A705E4842D0F615B1BA1C98A2',
                publicKey: 'D22DBD053E6913005DE2E59A3907C88CD6AB081B8BC1AC26EE24BDEB09B8BDA2',
            },
            {
                privateKey: '6ED4C590110285572FB60F1F2ADF50F2DF96991B0A72E86241B2D44B4CE7E696',
                publicKey: '5F4F8760D675F6836D4C07576F88B179BFE4471EDFBA4ECD2399C8F1EF02EE71',
            },
        ]);
    });
});
