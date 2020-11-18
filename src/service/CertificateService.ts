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

import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { Convert } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { CertificatePair, ConfigPreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigParams } from './ConfigService';

type CertificateParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

interface NodeCertificates {
    main: CertificatePair;
    transport: CertificatePair;
}

export class CertificateService {
    constructor(private readonly root: string, protected readonly params: CertificateParams) {}

    public static toAns1(privateKey: string): string {
        const prefix = '302e020100300506032b657004220420';
        return `${prefix}${privateKey.toLowerCase()}`;
    }

    public static getCertificates(stdout: string): CertificatePair[] {
        const locations = (string: string, substring: string): number[] => {
            const indexes = [];
            let i = -1;
            while ((i = string.indexOf(substring, i + 1)) >= 0) indexes.push(i);
            return indexes;
        };

        const extractKey = (subtext: string): string => {
            const key = subtext
                .trim()
                .split(':')
                .map((m) => m.trim())
                .join('');
            if (!key || key.length !== 64) {
                throw Error(`SSL Certificate key cannot be loaded from the openssl script. Output: \n${subtext}`);
            }
            return key.toUpperCase();
        };

        const from = 'priv:';
        const middle = 'pub:';
        const to = 'Certificate';

        const indexes = locations(stdout, from);

        return indexes.map((index) => {
            const privateKey = extractKey(stdout.substring(index + from.length, stdout.indexOf(middle, index)));
            const publicKey = extractKey(stdout.substring(stdout.indexOf(middle, index) + middle.length, stdout.indexOf(to, index)));
            return { privateKey: privateKey, publicKey: publicKey };
        });
    }

    public async run(presetData: ConfigPreset, name: string, providedCertificates: NodeCertificates): Promise<void> {
        const copyFrom = `${this.root}/config/cert`;
        const certFolder = BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'userconfig', 'resources', 'cert');
        await BootstrapUtils.mkdir(certFolder);
        const newCertsFolder = join(certFolder, 'new_certs');
        await BootstrapUtils.mkdir(newCertsFolder);
        const generatedContext = { name };
        await BootstrapUtils.generateConfiguration(generatedContext, copyFrom, certFolder, []);

        // if (!BootstrapUtils.isWindows()) {
        //     // chmodSync(newCertsFolder, 700);
        // }
        // await BootstrapUtils.writeTextFile(join(certFolder, 'index.txt'), '');
        // await BootstrapUtils.writeTextFile(join(certFolder, 'index.txt.attr'), '');
        // await BootstrapUtils.writeTextFile(join(certFolder, 'serial.dat'), Convert.uint8ToHex(Crypto.randomBytes(19)).toUpperCase());

        writeFileSync(join(certFolder, 'ca.der'), Convert.hexToUint8(CertificateService.toAns1(providedCertificates.main.privateKey)));
        writeFileSync(
            join(certFolder, 'node.der'),
            Convert.hexToUint8(CertificateService.toAns1(providedCertificates.transport.privateKey)),
        );

        // TODO. Migrate this process to forge, sshpk or any node native implementation.
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

        const certificates = CertificateService.getCertificates(stdout);
        if (certificates.length != 2) {
            throw new Error('Certificate creation failed. 2 certificates should have been created but got: ' + certificates.length);
        }
        logger.info(`Certificate for node ${name} created`);
        const caCertificate = certificates[0];
        const nodeCertificate = certificates[1];

        BootstrapUtils.validateIsTrue(caCertificate.privateKey === providedCertificates.main.privateKey, 'Invalid ca private key');
        BootstrapUtils.validateIsTrue(caCertificate.publicKey === providedCertificates.main.publicKey, 'Invalid ca public key');

        BootstrapUtils.validateIsTrue(nodeCertificate.privateKey === providedCertificates.transport.privateKey, 'Invalid Node private key');

        BootstrapUtils.validateIsTrue(nodeCertificate.publicKey === providedCertificates.transport.publicKey, 'Invalid Node public key');
    }

    private createCertCommands(target: string): string {
        return `set -e
cd ${target}
chmod 700 new_certs
touch index.txt.attr
touch index.txt

# create CA key
cat ca.der | openssl pkey -inform DER -outform PEM -out ca.key.pem
openssl pkey -inform pem -in ca.key.pem -text -noout
openssl pkey -in ca.key.pem -pubout -out ca.pubkey.pem

# create CA cert and self-sign it
openssl req -config ca.cnf -keyform PEM -key ca.key.pem -new -x509 -days 7300 -out ca.cert.pem
openssl x509 -in ca.cert.pem  -text -noout

# create node key
cat node.der | openssl pkey -inform DER -outform PEM -out node.key.pem
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
echo "Certificate Created"

# rm ca.key.pem
# rm ca.der
# rm node.der
`;
    }
}
