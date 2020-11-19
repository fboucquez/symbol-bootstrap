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

import { join, resolve } from 'path';
import * as sshpk from 'sshpk';
import { Key } from 'sshpk';
import { Convert, Crypto } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { CertificatePair, ConfigPreset, NodeAccount } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigParams } from './ConfigService';

const anySshpk = sshpk as any;
type CertificateParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

interface NodeCertificates {
    ssl: CertificatePair;
    node: CertificatePair;
}

interface SshpkKey {
    publicKey: string;
    privateKey: string;
    key: Key;
}

/**
 * TODO remote if not used!
 */
export class SshpkService {
    constructor(private readonly root: string, protected readonly params: CertificateParams) {}

    private async createKey(certFolder: string, privateKeyFileName: string, publicKeyFileName: string): Promise<SshpkKey> {
        const key = anySshpk.generatePrivateKey('ed25519');
        const privateKey = Convert.uint8ToHex(key.part.k.data);
        const publicKey = Convert.uint8ToHex(key.toPublic().part.A.data);

        console.log('pem', key.toString('pem'));
        console.log('openssh', key.toString('openssh'));
        console.log('ssh', key.toString('ssh'));
        console.log('pkcs1', key.toString('pkcs1'));

        await BootstrapUtils.writeTextFile(join(certFolder, privateKeyFileName), key.toString('pem'));
        await BootstrapUtils.writeTextFile(join(certFolder, publicKeyFileName), key.toPublic().toString('pem'));

        return {
            privateKey,
            publicKey,
            key,
        };
    }

    public async run(presetData: ConfigPreset, nodeAccount: NodeAccount): Promise<NodeCertificates> {
        const name = nodeAccount.name;
        const copyFrom = `${this.root}/config/cert`;

        const certFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'userconfig', 'resources', 'cert2');
        await BootstrapUtils.mkdir(certFolder);
        const newCertsFolder = join(certFolder, 'new_certs');
        await BootstrapUtils.mkdir(newCertsFolder);
        await BootstrapUtils.generateConfiguration({ name: name }, copyFrom, certFolder);

        if (!BootstrapUtils.isWindows()) {
            // fs.chmodSync(newCertsFolder, 700);
        }

        await BootstrapUtils.writeTextFile(join(certFolder, 'index.txt'), '');
        await BootstrapUtils.writeTextFile(join(certFolder, 'index.txt.attr'), '');
        await BootstrapUtils.writeTextFile(join(certFolder, 'serial.dat'), Convert.uint8ToHex(Crypto.randomBytes(19)).toUpperCase());

        const ssl = await this.createKey(certFolder, 'ca.key.pem', 'ca.pubkey.pem');
        const node = await this.createKey(certFolder, 'node.key.pem', 'node.pubkey.pem');

        // const certificate = sshpk.createSelfSignedCertificate('subject', ssl.key);
        // console.log(certificate);

        const command = this.createCertCommands('/data');
        await BootstrapUtils.writeTextFile(join(certFolder, 'createCertificate.sh'), command);
        const cmd = ['bash', 'createCertificate.sh'];
        const binds = [`${resolve(certFolder)}:/data:rw`];
        const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
        const symbolServerToolsImage = presetData.symbolServerToolsImage;
        const { stdout, stderr } = await BootstrapUtils.runImageUsingExec({
            catapultAppFolder: presetData.catapultAppFolder,
            image: symbolServerToolsImage,
            userId: userId,
            workdir: '/data',
            cmds: cmd,
            binds: binds,
        });
        if (stdout.indexOf('Certificate Created') < 0) {
            logger.info(stdout);
            logger.error(stderr);
            throw new Error('Certificate creation failed. Check the logs!');
        }
        console.log(stdout);
        console.log(stderr);

        // const key = sshpk.parseKey(node.node.privateKey, 'auto');

        // const generatePrivateKey = anySshpk.generatePrivateKey();

        // console.log(generatePrivateKey.toString('pem'));
        // console.log(generatePrivateKey.toPublic().toString('pem'));

        // console.log(generatePrivateKey);

        // const publicKey = generatePrivateKey.toPublic().part.A.data;
        // console.log(Convert.uint8ToHex(publicKey));

        // const privateKey = generatePrivateKey.part.k.data;
        // console.log(Convert.uint8ToHex(privateKey));

        return { ssl, node };
    }

    private createCertCommands(target: string): string {
        return `
set -e

# create CA cert and self-sign it
openssl req -config ca.cnf -keyform PEM -key ca.key.pem -new -x509 -days 7300 -out ca.cert.pem
openssl x509 -in ca.cert.pem  -text -noout

# create node key

# create request
openssl req -config node.cnf -key node.key.pem -new -out node.csr.pem
openssl req  -text -noout -verify -in node.csr.pem

### below is done after files are written

# sign cert for 375 days
openssl ca -batch -config ca.cnf -days 375 -notext -in node.csr.pem -out node.crt.pem
openssl verify -CAfile ca.cert.pem node.crt.pem

# finally create full crt
cat node.crt.pem ca.cert.pem > node.full.crt.pem
echo "Certificate Created"
`;
    }
}
