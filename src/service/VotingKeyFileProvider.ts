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
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Account } from 'symbol-sdk';
import { Logger } from '../logger';
import { ConfigPreset, NodeAccount, NodePreset } from '../model';
import { RuntimeService } from './RuntimeService';
import { VotingUtils } from './VotingUtils';

export interface VotingKeyParams {
    presetData: ConfigPreset;
    nodeAccount: NodeAccount;
    nodePreset: NodePreset;
    votingKeysFolder: string;
    privateKeyTreeFileName: string;
    votingKeyStartEpoch: number;
    votingKeyEndEpoch: number;
}

export interface VotingKeyCreationResult {
    publicKey: string;
}

export interface VotingKeyFileProvider {
    createVotingFile(params: VotingKeyParams): Promise<VotingKeyCreationResult>;
}

export class NativeVotingKeyFileProvider implements VotingKeyFileProvider {
    private readonly runtimeService: RuntimeService;
    constructor(private readonly logger: Logger) {
        this.runtimeService = new RuntimeService(logger);
    }
    public async createVotingFile({
        presetData,
        votingKeysFolder,
        privateKeyTreeFileName,
        votingKeyStartEpoch,
        votingKeyEndEpoch,
    }: VotingKeyParams): Promise<VotingKeyCreationResult> {
        const votingAccount = Account.generateNewAccount(presetData.networkType);
        const votingPrivateKey = votingAccount.privateKey;
        const votingUtils = new VotingUtils();
        this.logger.info('Voting file is created using the native typescript voting key file generator!');
        const votingFile = await votingUtils.createVotingFile(votingPrivateKey, votingKeyStartEpoch, votingKeyEndEpoch);
        writeFileSync(join(votingKeysFolder, privateKeyTreeFileName), votingFile);
        return {
            publicKey: votingAccount.publicKey,
        };
    }
}

export class CatapultVotingKeyFileProvider implements VotingKeyFileProvider {
    private readonly runtimeService: RuntimeService;
    constructor(private readonly logger: Logger, private readonly user: string) {
        this.runtimeService = new RuntimeService(logger);
    }
    public async createVotingFile({
        presetData,
        votingKeysFolder,
        privateKeyTreeFileName,
        votingKeyStartEpoch,
        votingKeyEndEpoch,
    }: VotingKeyParams): Promise<VotingKeyCreationResult> {
        this.logger.info(`Voting file is created using docker and catapult.tools.votingkey`);
        const votingAccount = Account.generateNewAccount(presetData.networkType);
        const votingPrivateKey = votingAccount.privateKey;
        const symbolServerImage = presetData.symbolServerImage;
        const binds = [`${votingKeysFolder}:/votingKeys:rw`];
        const cmd = [
            `${presetData.catapultAppFolder}/bin/catapult.tools.votingkey`,
            `--secret=${votingPrivateKey}`,
            `--startEpoch=${votingKeyStartEpoch}`,
            `--endEpoch=${votingKeyEndEpoch}`,
            `--output=/votingKeys/${privateKeyTreeFileName}`,
        ];
        const userId = await this.runtimeService.resolveDockerUserFromParam(this.user);
        const { stdout, stderr } = await this.runtimeService.runImageUsingExec({
            catapultAppFolder: presetData.catapultAppFolder,
            image: symbolServerImage,
            userId: userId,
            cmds: cmd,
            binds: binds,
        });

        if (stdout.indexOf('<error> ') > -1) {
            this.logger.info(stdout);
            this.logger.error(stderr);
            throw new Error('Voting key failed. Check the logs!');
        }
        return {
            publicKey: votingAccount.publicKey,
        };
    }
}
