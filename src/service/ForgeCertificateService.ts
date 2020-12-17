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

import * as forge from 'node-forge';
import { pki } from 'node-forge';
import { join } from 'path';
import { CertificatePair } from '../model';
import { BootstrapUtils } from './BootstrapUtils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
type CertificateParams = { target: string };

/**
 * TODO remove if not used!
 */
export class ForgeCertificateService {
    constructor(protected readonly params: CertificateParams) {}

    public async run(name: string): Promise<CertificatePair> {
        // Currently the SSL certifcates are created via a docker image. Migrate this to a native forge!
        // https://www.npmjs.com/package/node-forge

        const target = `${this.params.target}/config/${name}/resources/cert`;
        await BootstrapUtils.mkdir(target);

        const caKeyPair = await this.createCaCertificate(target, 'ca', `${name}-account`);
        await this.createNodeCertificate(target, 'node', name, caKeyPair);
        return { privateKey: 'a', publicKey: 'b' };
    }

    public async createCaCertificate(target: string, prefix: string, name: string): Promise<pki.KeyPair> {
        const keyPair = pki.rsa.generateKeyPair();
        const publicKeyPem = pki.publicKeyToPem(keyPair.publicKey);
        await BootstrapUtils.writeTextFile(join(target, `${prefix}.pubkey.pem`), publicKeyPem);
        // console.log(publicKeyPem);

        const privateKeyToPem = pki.privateKeyToPem(keyPair.privateKey);
        await BootstrapUtils.writeTextFile(join(target, `${prefix}.key.pem`), privateKeyToPem);

        const cert = pki.createCertificate();
        cert.publicKey = keyPair.publicKey;
        cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(20));
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 20);

        const attrs = [
            {
                shortName: 'CN',
                value: name,
            },
        ];
        cert.setSubject(attrs);
        cert.sign(keyPair.privateKey);

        // convert a Forge certificate to PEM
        const pemCertificate = pki.certificateToPem(cert);
        await BootstrapUtils.writeTextFile(join(target, `${prefix}.cert.pem`), pemCertificate);

        return keyPair;
    }

    public async createNodeCertificate(target: string, prefix: string, name: string, caKeyPair: pki.KeyPair): Promise<CertificatePair> {
        const keypair = pki.rsa.generateKeyPair();
        const publicKeyPem = pki.publicKeyToPem(keypair.publicKey);
        await BootstrapUtils.writeTextFile(join(target, `${prefix}.pubkey.pem`), publicKeyPem);
        // console.log(publicKeyPem);

        const privateKeyToPem = pki.privateKeyToPem(keypair.privateKey);
        await BootstrapUtils.writeTextFile(join(target, `${prefix}.key.pem`), privateKeyToPem);

        const cert = pki.createCertificationRequest();
        cert.publicKey = keypair.publicKey;
        cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(20));

        const attrs = [
            {
                shortName: 'CN',
                value: name,
            },
        ];
        cert.setSubject(attrs);
        cert.sign(caKeyPair.privateKey);

        // convert a Forge certificate to PEM
        const pemCertificate = pki.certificationRequestToPem(cert);
        await BootstrapUtils.writeTextFile(join(target, `${prefix}.csr.pem`), pemCertificate);

        return { privateKey: privateKeyToPem, publicKey: publicKeyPem };
    }

    private createCertCommands(target: string): string {
        return `
cd ${target}
set -e
mkdir new_certs && chmod 700 new_certs
touch index.txt

# create CA key
openssl genpkey -out ca.key.pem -outform PEM -algorithm ed25519
openssl pkey -inform pem -in ca.key.pem -text -noout
openssl pkey -in ca.key.pem -pubout -out ca.pubkey.pem

# create CA cert and self-sign it
openssl req -config ca.cnf -keyform PEM -key ca.key.pem -new -x509 -days 7300 -out ca.cert.pem
openssl x509 -in ca.cert.pem  -text -noout

# create node key
openssl genpkey -out node.key.pem -outform PEM -algorithm ed25519
openssl pkey -inform pem -in node.key.pem -text -noout

# create request
openssl req -config node.cnf -key node.key.pem -new -out node.csr.pem
openssl req  -text -noout -verify -in node.csr.pem

### below is done after files are written
# CA side
# create serial
openssl rand -hex 19 > ./serial.dat

# sign cert for 375 days
openssl ca -batch -config ca.cnf -days 375 -notext -in node.csr.pem -out node.crt.pem
openssl verify -CAfile ca.cert.pem node.crt.pem

# finally create full crt
cat node.crt.pem ca.cert.pem > node.full.crt.pem
`;
    }
}
