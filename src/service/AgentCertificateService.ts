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
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { BootstrapUtils } from './BootstrapUtils';

export interface AgentCertificateParams {
    readonly target: string;
    readonly user: string;
}

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class AgentCertificateService {
    constructor(private readonly root: string, protected readonly params: AgentCertificateParams) {}

    public async run(symbolServerToolsImage: string, name: string, customCertFolder?: string): Promise<void> {
        const copyFrom = `${this.root}/config/agent-cert`;
        const certFolder = customCertFolder || BootstrapUtils.getTargetNodesFolder(this.params.target, false, name, 'userconfig', 'agent');
        await BootstrapUtils.mkdir(certFolder);
        const generatedContext = { name };
        await BootstrapUtils.generateConfiguration(generatedContext, copyFrom, certFolder, []);
        const command = this.createCertCommands('/data');
        await BootstrapUtils.writeTextFile(join(certFolder, 'createCertificate.sh'), command);
        const cmd = ['bash', 'createCertificate.sh'];
        const binds = [`${resolve(certFolder)}:/data:rw`];
        const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
        const { stdout, stderr } = await BootstrapUtils.runImageUsingExec({
            image: symbolServerToolsImage,
            userId: userId,
            workdir: '/data',
            cmds: cmd,
            binds: binds,
        });
        if (stdout.indexOf('Certificate Created') < 0) {
            logger.info(BootstrapUtils.secureString(stdout));
            logger.error(BootstrapUtils.secureString(stderr));
            throw new Error('Certificate creation failed. Check the logs!');
        }
        logger.info(`Agent Certificate for node ${name} created`);
    }

    private createCertCommands(target: string): string {
        return `set -e
        cd ${target}
# Creating a self signed certificate for the agent. This will be created by bootstrap when setting up a supernode
openssl genrsa -out agent-key.pem 4096
openssl req -new -config agent.cnf -key agent-key.pem -out agent-csr.pem
openssl x509 -req -extfile agent.cnf -days 999 -in agent-csr.pem -out agent-crt.pem -signkey agent-key.pem


rm createCertificate.sh
rm agent-csr.pem
rm agent.cnf

echo "Certificate Created"
`;
    }
}
