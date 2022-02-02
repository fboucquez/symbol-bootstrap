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

import { existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { Convert, Crypto, NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { CertificatePair } from '../model';
import { AccountResolver } from './AccountResolver';
import { KeyName } from './ConfigService';
import { Constants } from './Constants';
import { FileSystemService } from './FileSystemService';
import { HandlebarsUtils } from './HandlebarsUtils';
import { RuntimeService } from './RuntimeService';
import { Utils } from './Utils';
import { YamlUtils } from './YamlUtils';

export interface CertificateParams {
    readonly target: string;
    readonly user?: string;
}

export interface CertificateMetadata {
    readonly transportPublicKey: string;
    readonly mainPublicKey: string;
    readonly version: number;
}

export interface NodeCertificates {
    main: CertificatePair;
    transport: CertificatePair;
}

export interface CertificateConfigPreset {
    networkType: NetworkType;
    symbolServerImage: string;
    caCertificateExpirationInDays: number;
    nodeCertificateExpirationInDays: number;
    certificateExpirationWarningInDays: number;
}

export enum RenewMode {
    ONLY_WARNING,
    WHEN_REQUIRED,
    ALWAYS,
}

export class CertificateService {
    public static NODE_CERTIFICATE_FILE_NAME = 'node.crt.pem';
    public static CA_CERTIFICATE_FILE_NAME = 'ca.cert.pem';
    private static readonly METADATA_VERSION = 1;
    private readonly fileSystemService: FileSystemService;
    private readonly runtimeService: RuntimeService;

    constructor(
        private readonly logger: Logger,
        private readonly accountResolver: AccountResolver,
        protected readonly params: CertificateParams,
    ) {
        this.runtimeService = new RuntimeService(this.logger);
        this.fileSystemService = new FileSystemService(logger);
    }

    public async run(
        presetData: CertificateConfigPreset,
        name: string,
        providedCertificates: NodeCertificates,
        renewMode: RenewMode,
        customCertFolder?: string,
        randomSerial?: string,
    ): Promise<boolean> {
        const certFolder = customCertFolder || this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'cert');
        const metadataFile = join(certFolder, 'metadata.yml');
        if (!(await this.shouldGenerateCertificate(metadataFile, providedCertificates))) {
            const willExpireReport = await this.willCertificateExpire(
                presetData.symbolServerImage,
                certFolder,
                CertificateService.NODE_CERTIFICATE_FILE_NAME,
                presetData.certificateExpirationWarningInDays,
            );
            const shouldRenew = (willExpireReport.willExpire && renewMode == RenewMode.WHEN_REQUIRED) || renewMode == RenewMode.ALWAYS;
            const logWarning =
                (willExpireReport.willExpire && renewMode == RenewMode.ONLY_WARNING) ||
                (!willExpireReport.willExpire && renewMode == RenewMode.ALWAYS);

            const resolveRenewMessage = (): string => {
                if (willExpireReport.willExpire) {
                    if (renewMode == RenewMode.WHEN_REQUIRED || renewMode == RenewMode.ALWAYS) {
                        return `The ${CertificateService.NODE_CERTIFICATE_FILE_NAME} certificate for node ${name} will expire in less than ${presetData.certificateExpirationWarningInDays} days on ${willExpireReport.expirationDate}. Renewing...`;
                    } else {
                        return `The ${CertificateService.NODE_CERTIFICATE_FILE_NAME} certificate for node ${name} will expire in less than ${presetData.certificateExpirationWarningInDays} days on ${willExpireReport.expirationDate}. You need to renew it.`;
                    }
                } else {
                    if (renewMode == RenewMode.ALWAYS) {
                        return `The ${CertificateService.NODE_CERTIFICATE_FILE_NAME} certificate for node ${name} will expire on ${willExpireReport.expirationDate}, renewing anyway...`;
                    } else {
                        return `The ${CertificateService.NODE_CERTIFICATE_FILE_NAME} certificate for node ${name} will expire on ${willExpireReport.expirationDate}. No need to renew it yet.`;
                    }
                }
            };
            const message = resolveRenewMessage();
            if (logWarning) this.logger.warn(message);
            else this.logger.info(message);

            if (shouldRenew) {
                await this.createCertificate(true, presetData, certFolder, name, providedCertificates, metadataFile, randomSerial);
            }
            return shouldRenew;
        } else {
            await this.createCertificate(false, presetData, certFolder, name, providedCertificates, metadataFile, randomSerial);
            return true;
        }
    }

    private async createCertificate(
        renew: boolean,
        presetData: CertificateConfigPreset,
        certFolder: string,
        name: string,
        providedCertificates: NodeCertificates,
        metadataFile: string,
        randomSerial?: string,
    ) {
        const copyFrom = join(Constants.ROOT_FOLDER, 'config', 'cert');
        const networkType = presetData.networkType;

        const mainAccount = await this.accountResolver.resolveAccount(
            networkType,
            providedCertificates.main,
            KeyName.Main,
            name,
            'generating the server CA certificates',
            'Should not generate!',
        );
        const transportAccount = await this.accountResolver.resolveAccount(
            networkType,
            providedCertificates.transport,
            KeyName.Transport,
            name,
            'generating the server Node certificates',
            'Should not generate!',
        );

        if (!renew) {
            this.fileSystemService.deleteFolder(certFolder);
        }

        await this.fileSystemService.mkdir(certFolder);
        const generatedContext = { name };
        await HandlebarsUtils.generateConfiguration(generatedContext, copyFrom, certFolder, []);

        CertificateService.createDerFile(mainAccount.privateKey, join(certFolder, 'ca.der'));
        CertificateService.createDerFile(transportAccount.privateKey, join(certFolder, 'node.der'));
        await YamlUtils.writeTextFile(
            join(certFolder, 'serial.dat'),
            (randomSerial?.trim() || Convert.uint8ToHex(Crypto.randomBytes(19))).toLowerCase() + '\n',
        );

        const command = this.createCertCommands(
            renew,
            presetData.caCertificateExpirationInDays,
            presetData.nodeCertificateExpirationInDays,
        );
        await YamlUtils.writeTextFile(join(certFolder, 'createNodeCertificates.sh'), command);

        const { stdout, stderr } = await this.runOpenSslCommand(
            presetData.symbolServerImage,
            'bash createNodeCertificates.sh',
            certFolder,
            false,
        );
        if (stdout.indexOf('Certificate Created') < 0) {
            this.logger.info(Utils.secureString(stdout));
            this.logger.error(Utils.secureString(stderr));
            throw new Error('Certificate creation failed. Check the logs!');
        }

        const certificates = CertificateService.getCertificates(stdout);
        if (certificates.length != 2) {
            throw new Error('Certificate creation failed. 2 certificates should have been created but got: ' + certificates.length);
        }
        this.logger.info(renew ? `Certificate for node ${name} renewed.` : `Certificate for node ${name} created.`);
        const caCertificate = certificates[0];
        const nodeCertificate = certificates[1];

        Utils.validateIsTrue(caCertificate.privateKey === mainAccount.privateKey, 'Invalid ca private key');
        Utils.validateIsTrue(caCertificate.publicKey === providedCertificates.main.publicKey, 'Invalid ca public key');
        Utils.validateIsTrue(nodeCertificate.privateKey === transportAccount.privateKey, 'Invalid Node private key');
        Utils.validateIsTrue(nodeCertificate.publicKey === providedCertificates.transport.publicKey, 'Invalid Node public key');

        const metadata: CertificateMetadata = {
            version: CertificateService.METADATA_VERSION,
            transportPublicKey: providedCertificates.transport.publicKey,
            mainPublicKey: providedCertificates.main.publicKey,
        };
        await YamlUtils.writeYaml(metadataFile, metadata, undefined);
    }

    private async shouldGenerateCertificate(metadataFile: string, providedCertificates: NodeCertificates): Promise<boolean> {
        if (!existsSync(metadataFile)) {
            return true;
        }
        try {
            const metadata = YamlUtils.loadYaml(metadataFile, false) as CertificateMetadata;
            return (
                metadata.mainPublicKey !== providedCertificates.main.publicKey ||
                metadata.transportPublicKey !== providedCertificates.transport.publicKey ||
                metadata.version !== CertificateService.METADATA_VERSION
            );
        } catch (e) {
            this.logger.warn(`Cannot load node certificate metadata from file ${metadataFile}. Error: ${Utils.getMessage(e)}`, e);
            return true;
        }
    }

    private createCertCommands(renew: boolean, caCertificateExpirationInDays: number, nodeCertificateExpirationInDays: number): string {
        const createCaCertificate = renew
            ? `openssl x509 -in ${CertificateService.CA_CERTIFICATE_FILE_NAME}  -text -noout`
            : `# create CA cert and self-sign it
    openssl req -config ca.cnf -keyform PEM -key ca.key.pem -new -x509 -days ${caCertificateExpirationInDays} -out ${CertificateService.CA_CERTIFICATE_FILE_NAME}
    openssl x509 -in ${CertificateService.CA_CERTIFICATE_FILE_NAME}  -text -noout
    `;
        return `set -e

# Clean up old versions files.
rm -rf new_certs
rm -f index.txt*

mkdir new_certs
chmod 700 new_certs
touch index.txt.attr
touch index.txt

# create CA key
cat ca.der | openssl pkey -inform DER -outform PEM -out ca.key.pem
openssl pkey -inform pem -in ca.key.pem -text -noout
openssl pkey -in ca.key.pem -pubout -out ca.pubkey.pem

${createCaCertificate}

# create node key
cat node.der | openssl pkey -inform DER -outform PEM -out node.key.pem
openssl pkey -inform pem -in node.key.pem -text -noout

# create request
openssl req -config node.cnf -key node.key.pem -new -out node.csr.pem
openssl req  -text -noout -verify -in node.csr.pem

### below is done after files are written
# CA side

# sign cert for 375 days
openssl ca -batch -config ca.cnf -days ${nodeCertificateExpirationInDays} -notext -in node.csr.pem -out ${CertificateService.NODE_CERTIFICATE_FILE_NAME}
openssl verify -CAfile ${CertificateService.CA_CERTIFICATE_FILE_NAME} ${CertificateService.NODE_CERTIFICATE_FILE_NAME}

# finally create full crt
cat ${CertificateService.NODE_CERTIFICATE_FILE_NAME} ${CertificateService.CA_CERTIFICATE_FILE_NAME} > node.full.crt.pem

rm createNodeCertificates.sh
rm ca.key.pem
rm ca.der
rm node.der
rm node.csr.pem
rm *.cnf
rm index.txt*
rm serial.dat*
rm -rf new_certs

echo "Certificate Created"
`;
    }

    public async willCertificateExpire(
        symbolServerImage: string,
        certFolder: string,
        certificateFileName: string,
        certificateExpirationWarningInDays: number,
    ): Promise<{ willExpire: boolean; expirationDate: string }> {
        const command = `openssl x509 -enddate -noout -in ${certificateFileName} -checkend ${
            certificateExpirationWarningInDays * 24 * 60 * 60
        }`;
        const { stdout, stderr } = await this.runOpenSslCommand(symbolServerImage, command, certFolder, true);
        const expirationDate = stdout.match('notAfter\\=(.*)\\n')?.[1];
        if (!expirationDate) {
            this.logger.info(Utils.secureString(stdout));
            this.logger.error(Utils.secureString(stderr));
            throw new Error(
                `Cannot validate ${certificateFileName} certificate expiration. Expiration Date cannot be resolved. Check the logs!`,
            );
        }
        if (stdout.indexOf('Certificate will expire') > -1) {
            return {
                willExpire: true,
                expirationDate: expirationDate,
            };
        }
        if (stdout.indexOf('Certificate will not expire') > -1) {
            return {
                willExpire: false,
                expirationDate: expirationDate,
            };
        }
        this.logger.info(Utils.secureString(stdout));
        this.logger.error(Utils.secureString(stderr));
        throw new Error(`Cannot validate ${certificateFileName} certificate expiration. Check the logs!`);
    }

    private async runOpenSslCommand(
        symbolServerImage: string,
        cmd: string,
        certFolder: string,
        ignoreErrors: boolean,
    ): Promise<{
        stdout: string;
        stderr: string;
    }> {
        const userId = await this.runtimeService.resolveDockerUserFromParam(this.params.user);
        const binds = [`${resolve(certFolder)}:/data:rw`];
        const { stdout, stderr } = await this.runtimeService.runImageUsingExec({
            image: symbolServerImage,
            userId: userId,
            workdir: '/data',
            cmds: cmd.split(' '),
            binds: binds,
            ignoreErrors: ignoreErrors,
        });
        return { stdout, stderr };
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

        return locations(stdout, from).map((index) => {
            const privateKey = extractKey(stdout.substring(index + from.length, stdout.indexOf(middle, index)));
            const publicKey = extractKey(stdout.substring(stdout.indexOf(middle, index) + middle.length, stdout.indexOf(to, index)));
            return { privateKey: privateKey, publicKey: publicKey };
        });
    }

    public static createDerFile(privateKey: string, file: string): void {
        writeFileSync(file, Convert.hexToUint8(this.toAns1(privateKey)));
    }
    public static toAns1(privateKey: string): string {
        const prefix = '302e020100300506032b657004220420';
        return `${prefix}${privateKey.toLowerCase()}`;
    }
}
