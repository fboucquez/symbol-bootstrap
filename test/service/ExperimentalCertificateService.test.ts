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
import 'mocha';
import * as sshpk from 'sshpk';
import { Account, Convert, NetworkType } from 'symbol-sdk';

const anySshpk = sshpk as any;
describe('sshpk', () => {
    it('sshpk certificate generated', async () => {
        const hex = 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD';

        const keyText = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIMqC562vercppUYqG9WqeGMjkGNJBKZOsbsiKV4uGhvd
-----END PRIVATE KEY-----
`;

        const key = anySshpk.parsePrivateKey(keyText);
        const privateKey = Convert.uint8ToHex(key.part.k.data);
        const publicKey = Convert.uint8ToHex(key.toPublic().part.A.data);
        expect(hex).eq(privateKey);
        console.log(key.toPublic().toString('pem'));
        expect(publicKey).eq(Account.createFromPrivateKey(privateKey, NetworkType.MIJIN_TEST).publicKey);
        //
        // const object = createSelfSignedCertificate({ subject: 'adsf' } as any, key, { lifetime: 7300 * 86400 });
        // console.log(object);
    });
});

describe('ForgeCertificateService', () => {
    it('certificate generated', async () => {
        // const der = readFileSync('ca.der', { encoding: 'binary' });
        // const asn1 = forge.asn1.fromDer(der);
        // const publicKey = forge.pki.publicKeyFromAsn1(asn1);
        // const pem = forge.pki.publicKeyToPem(publicKey);
        // console.log(pem);

        const key = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIMqC562vercppUYqG9WqeGMjkGNJBKZOsbsiKV4uGhvd
-----END PRIVATE KEY-----
`;

        // const privateKey = forge.pki.privateKeyFromPem(key);
        // const message = 'abc';
        // const buffer = forge.util.createBuffer(message, 'utf8');
        // const binaryString = buffer.getBytes();
        //
        // console.log(binaryString);

        // const privateKey = 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD';
        // const derFile = 'ca.der';
        // BootstrapUtils.createDerFile(privateKey, derFile);
        // await BootstrapUtils.exec('cat ca.der | openssl pkey -inform DER -outform PEM -out ca.key.pem');
        //
        // const forgePrivateKey = forge.pki.decryptRsaPrivateKey(await BootstrapUtils.readTextFile('ca.key.pem'));

        // const der = readFileSync(derFile, { encoding: 'binary' });
        // const asn1 = forge.asn1.fromDer(der);
        // const privateKeyDer = forge.pki.privateKeyToAsn1(asn1 as forge.pki.PrivateKey);

        // const privateKeyObject = forge.pki.decryptRsaPrivateKey(derFile);
        // const ed25519 = forge.pki.ed25519;
        // const keypair = ed25519.generateKeyPair();
        // console.log(keypair.privateKey);
        // `keypair.publicKey` is a node.js Buffer or Uint8Array
        // `keypair.privateKey` is a node.js Buffer or Uint8Array
    });
});
