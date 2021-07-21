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

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { CertificatePair } from '../model';
import { AccountResolver } from './AccountResolver';
import { BootstrapUtils } from './BootstrapUtils';
import { CertificateService } from './CertificateService';
import { KeyName } from './ConfigService';
export interface AgentCertificateParams {
    readonly target: string;
    readonly user: string;
    readonly accountResolver: AccountResolver;
}

export interface AgentCertificates {
    readonly agent: CertificatePair;
}

export interface AgentCertificateMetadata {
    readonly agentPublicKey: string;
    readonly version: number;
}

export class AgentCertificateService {
    private static readonly METADATA_VERSION = 1;
    constructor(private readonly logger: Logger, protected readonly params: AgentCertificateParams) {}

    public async run(
        networkType: NetworkType,
        symbolServerImage: string,
        name: string,
        providedCertificates: AgentCertificates,
        customCertFolder?: string,
    ): Promise<void> {
        const copyFrom = join(BootstrapUtils.DEFAULT_ROOT_FOLDER, 'config', 'agent-cert');
        const certFolder = customCertFolder || BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'agent');
        await BootstrapUtils.mkdir(certFolder);

        const metadataFile = join(certFolder, 'metadata.yml');
        if (!(await this.shouldGenerateCertificate(metadataFile, providedCertificates))) {
            this.logger.info(`Agent Certificates for node ${name} have been previously generated. Reusing...`);
            return;
        }
        await BootstrapUtils.deleteFolder(this.logger, certFolder);
        await BootstrapUtils.mkdir(certFolder);
        const newCertsFolder = join(certFolder, 'new_certs');
        await BootstrapUtils.mkdir(newCertsFolder);

        const generatedContext = { name };
        await BootstrapUtils.generateConfiguration(generatedContext, copyFrom, certFolder, []);

        const agentAccount = await this.params.accountResolver.resolveAccount(
            networkType,
            providedCertificates.agent,
            KeyName.Agent,
            name,
            'generating the Agent certificates',
            'Should not generate!',
        );
        BootstrapUtils.createDerFile(agentAccount.privateKey, join(certFolder, 'agent-ca.der'));

        const command = this.createCertCommands('/data');
        await BootstrapUtils.writeTextFile(join(certFolder, 'createAgentCertificate.sh'), command);
        const cmd = ['bash', 'createAgentCertificate.sh'];
        const binds = [`${resolve(certFolder)}:/data:rw`];
        const userId = await BootstrapUtils.resolveDockerUserFromParam(this.logger, this.params.user);
        const { stdout, stderr } = await BootstrapUtils.runImageUsingExec(this.logger, {
            image: symbolServerImage,
            userId: userId,
            workdir: '/data',
            cmds: cmd,
            binds: binds,
        });
        if (stdout.indexOf('Certificate Created') < 0) {
            this.logger.info(BootstrapUtils.secureString(stdout));
            this.logger.error(BootstrapUtils.secureString(stderr));
            throw new Error('Certificate creation failed. Check the logs!');
        }

        const certificates = CertificateService.getCertificates(stdout);
        if (certificates.length != 1) {
            throw new Error('Certificate creation failed. 1 certificates should have been created but got: ' + certificates.length);
        }
        const agentCertificate = certificates[0];
        BootstrapUtils.validateIsTrue(agentCertificate.privateKey === agentAccount.privateKey, 'Invalid agent private key');
        BootstrapUtils.validateIsTrue(agentCertificate.publicKey === providedCertificates.agent.publicKey, 'Invalid agent public key');
        this.logger.info(`Agent Certificate for node ${name} created`);
        const metadata: AgentCertificateMetadata = {
            version: AgentCertificateService.METADATA_VERSION,
            agentPublicKey: providedCertificates.agent.publicKey,
        };
        await BootstrapUtils.writeYaml(metadataFile, metadata, undefined);
    }
    private async shouldGenerateCertificate(metadataFile: string, providedCertificates: AgentCertificates): Promise<boolean> {
        if (!existsSync(metadataFile)) {
            return true;
        }
        try {
            const metadata = (await BootstrapUtils.loadYaml(metadataFile, false)) as AgentCertificateMetadata;
            return (
                metadata.agentPublicKey !== providedCertificates.agent.publicKey ||
                metadata.version !== AgentCertificateService.METADATA_VERSION
            );
        } catch (e) {
            this.logger.warn(`Cannot load agent certificate metadata from file ${metadataFile}. Error: ${e.message}`, e);
            return true;
        }
    }

    // Alternative reading the public key from agent-ca.pubkey.pem
    // It's ok but it requires sshpk and unsure how to force an regeneration
    // private async shouldGenerateCertificate(certFolder: string, providedCertificates: AgentCertificates): Promise<boolean> {
    //   const pemFile = join(certFolder, 'agent-ca.pubkey.pem');
    //   if (!existsSync(pemFile)) {
    //     return true;
    //   }
    //   try {
    //     const data = readFileSync(pemFile);
    //     const key = sshpk.parseKey(data, 'pem');
    //     const storedPublicKey = Convert.uint8ToHex((key.part as any).A.data);
    //     return storedPublicKey !== providedCertificates.agent.publicKey;
    //   } catch (e) {
    //     this.logger.warn(`Cannot extract public key from file ${pemFile}. Error: ${e.message}`, e);
    //     return true;
    //   }
    // }

    private createCertCommands(target: string): string {
        return `set -e
cd ${target}

# prepare dirs/files
chmod 700 new_certs
touch index.txt

# Creating a self signed certificate for the agent. This will be created by bootstrap when setting up a supernode

cat agent-ca.der | openssl pkey -inform DER -outform PEM -out agent-ca.key.pem
openssl pkey -inform pem -in agent-ca.key.pem -text -noout
openssl pkey -in agent-ca.key.pem -pubout -out agent-ca.pubkey.pem

# create agent CA CSR
openssl req -config agent-ca.cnf -key agent-ca.key.pem -new -out agent-ca.csr.pem

rm createAgentCertificate.sh
rm agent-ca.der
rm -rf new_certs
rm index.txt*

echo "Certificate Created"
`;
    }
}
