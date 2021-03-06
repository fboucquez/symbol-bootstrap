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
import { NetworkType } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { CertificatePair } from '../model';
import { BootstrapUtils, ExecOutput, KnownError } from './BootstrapUtils';
import { CommandUtils } from './CommandUtils';
import { KeyName } from './ConfigService';

export interface CertificateParams {
    readonly target: string;
    readonly user: string;
    readonly offline?: boolean;
}

export interface CertificateMetadata {
    readonly transportPublicKey: string;
    readonly mainPublicKey: string;
    readonly version: number;
}

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export interface NodeCertificates {
    main: CertificatePair;
    transport: CertificatePair;
}

export class CertificateService {
    private static readonly METADATA_VERSION = 1;

    constructor(private readonly root: string, protected readonly params: CertificateParams) {}

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

    public async run(
        networkType: NetworkType,
        symbolServerToolsImage: string,
        name: string,
        providedCertificates: NodeCertificates,
        customCertFolder?: string,
    ): Promise<void> {
        const certFolder = customCertFolder || BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'cert');

        const metadataFile = join(certFolder, 'metadata.yml');

        if (!(await this.shouldGenerateCertificate(metadataFile, providedCertificates))) {
            logger.info(`Certificates for node ${name} have been previously generated. Reusing...`);
            return;
        }
        await this.exec(networkType, symbolServerToolsImage, name, providedCertificates, certFolder);
        logger.info(`Certificates for node ${name} created`);
        const metadata: CertificateMetadata = {
            version: CertificateService.METADATA_VERSION,
            transportPublicKey: providedCertificates.transport.publicKey,
            mainPublicKey: providedCertificates.main.publicKey,
        };
        await BootstrapUtils.writeYaml(metadataFile, metadata, undefined);
    }

    private async exec(
        networkType: NetworkType,
        symbolServerToolsImage: string,
        name: string,
        providedCertificates: NodeCertificates,
        certFolder: string,
    ): Promise<ExecOutput> {
        const copyFrom = `${this.root}/config/cert`;
        await BootstrapUtils.deleteFolder(certFolder);
        await BootstrapUtils.mkdir(certFolder);
        const newCertsFolder = join(certFolder, 'new_certs');
        await BootstrapUtils.mkdir(newCertsFolder);
        const generatedContext = { name };
        await BootstrapUtils.generateConfiguration(generatedContext, copyFrom, certFolder, []);
        // TODO. Migrate this process to forge, sshpk or any node native implementation.
        const command = this.createCertCommands();
        await BootstrapUtils.writeTextFile(join(certFolder, 'createNodeCertificates.sh'), command);
        const cmd = ['bash', 'createNodeCertificates.sh'];

        const mainAccountPrivateKey = await CommandUtils.resolvePrivateKey(networkType, providedCertificates.main, KeyName.Main, name);
        const transportPrivateKey = await CommandUtils.resolvePrivateKey(
            networkType,
            providedCertificates.transport,
            KeyName.Transport,
            name,
        );
        const caDerFile = join(certFolder, 'ca.der');
        const nodeDerFile = join(certFolder, 'node.der');
        try {
            BootstrapUtils.createDerFile(mainAccountPrivateKey, caDerFile);
            BootstrapUtils.createDerFile(transportPrivateKey, nodeDerFile);
            try {
                logger.info('Creating Node Certificates using exec and local openssl');
                const execOutput = await BootstrapUtils.exec(cmd.join(' '), {
                    cwd: certFolder,
                });
                await this.validateOutput(execOutput, providedCertificates, mainAccountPrivateKey, transportPrivateKey);
                return execOutput;
            } catch (e) {
                if (this.params.offline) {
                    throw new KnownError(
                        `Node Certificates could not be created using local openssl. Do you have openssl installed? Remove --offline to fallback to docker. Error: ${e.message}`,
                    );
                }
                logger.warn('Node Certificates could not be created using local openssl. Falling back to docker run...');
            }
            const binds = [`${resolve(certFolder)}:/data:rw`];
            const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
            const execOutput = await BootstrapUtils.runImageUsingExec({
                image: symbolServerToolsImage,
                userId: userId,
                workdir: '/data',
                cmds: cmd,
                binds: binds,
            });
            await this.validateOutput(execOutput, providedCertificates, mainAccountPrivateKey, transportPrivateKey);
            return execOutput;
        } finally {
            //To be sure we are not keeping any private file
            BootstrapUtils.deleteFile(join(certFolder, 'ca.key.pem'));
            BootstrapUtils.deleteFile(caDerFile);
            BootstrapUtils.deleteFile(nodeDerFile);
        }
    }

    private async validateOutput(
        { stdout, stderr }: ExecOutput,
        providedCertificates: NodeCertificates,
        mainAccountPrivateKey: string,
        transportPrivateKey: string,
    ) {
        if (stdout.indexOf('Certificate Created') < 0) {
            logger.info(BootstrapUtils.secureString(stdout));
            logger.error(BootstrapUtils.secureString(stderr));
            throw new Error('Certificate creation failed. Check the logs!');
        }

        const certificates = CertificateService.getCertificates(stdout);
        if (certificates.length != 2) {
            throw new Error('Certificate creation failed. 2 certificates should have been created but got: ' + certificates.length);
        }
        const caCertificate = certificates[0];
        const nodeCertificate = certificates[1];
        BootstrapUtils.validateIsTrue(caCertificate.privateKey === mainAccountPrivateKey, 'Invalid ca private key');
        BootstrapUtils.validateIsTrue(caCertificate.publicKey === providedCertificates.main.publicKey, 'Invalid ca public key');
        BootstrapUtils.validateIsTrue(nodeCertificate.privateKey === transportPrivateKey, 'Invalid Node private key');
        BootstrapUtils.validateIsTrue(nodeCertificate.publicKey === providedCertificates.transport.publicKey, 'Invalid Node public key');
    }

    private async shouldGenerateCertificate(metadataFile: string, providedCertificates: NodeCertificates): Promise<boolean> {
        try {
            const metadata = BootstrapUtils.loadYaml(metadataFile, false) as CertificateMetadata;
            return (
                metadata.mainPublicKey !== providedCertificates.main.publicKey ||
                metadata.transportPublicKey !== providedCertificates.transport.publicKey ||
                metadata.version !== CertificateService.METADATA_VERSION
            );
        } catch (e) {
            return true;
        }
    }

    private createCertCommands(): string {
        return `set -e
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

rm createNodeCertificates.sh
rm ca.key.pem
rm ca.der
rm node.der

echo "Certificate Created"
`;
    }
}
