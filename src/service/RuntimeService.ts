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

import { exec as callbackExec, spawn } from 'child_process';
import * as util from 'util';
import { Logger } from '../logger';
import { OSUtils } from './OSUtils';
import { Utils } from './Utils';
const exec = util.promisify(callbackExec);

export interface SpawnParams {
    command: string;
    args: string[];
    useLogger: boolean;
    logPrefix?: string;
    shell?: boolean;
}

export interface RunImageUsingExecParams {
    catapultAppFolder?: string;
    image: string;
    userId?: string;
    workdir?: string;
    cmds: string[];
    binds: string[];
    ignoreErrors?: boolean;
}

/**
 * Service in charge of running OS commands. Commands could be executed directly on the OS or via docker containers.
 */
export class RuntimeService {
    private static readonly pulledImages: string[] = [];
    private static dockerUserId: string;
    public static readonly CURRENT_USER = 'current';
    constructor(private readonly logger: Logger) {}

    public exec(runCommand: string, ignoreErrors?: boolean): Promise<{ stdout: string; stderr: string }> {
        this.logger.debug(`Exec command: ${runCommand}`);
        return exec(runCommand).catch((error) => {
            if (ignoreErrors) return { stdout: error.stdout, stderr: error.stderr };
            throw error;
        });
    }

    public runImageUsingExec({
        catapultAppFolder,
        image,
        userId,
        workdir,
        cmds,
        binds,
        ignoreErrors,
    }: RunImageUsingExecParams): Promise<{ stdout: string; stderr: string }> {
        const volumes = binds.map((b) => `-v ${b}`).join(' ');
        const userParam = userId ? `-u ${userId}` : '';
        const workdirParam = workdir ? `--workdir=${workdir}` : '';
        const environmentParam = catapultAppFolder ? `--env LD_LIBRARY_PATH=${catapultAppFolder}/lib:${catapultAppFolder}/deps` : '';
        const commandLine = cmds.map((a) => `"${a}"`).join(' ');
        const runCommand = `docker run --rm ${userParam} ${workdirParam} ${environmentParam} ${volumes} ${image} ${commandLine}`;
        this.logger.info(Utils.secureString(`Running image using Exec: ${image} ${cmds.join(' ')}`));
        return this.exec(runCommand, ignoreErrors);
    }

    public async spawn({ command, args, useLogger, logPrefix = '', shell }: SpawnParams): Promise<string> {
        const cmd = spawn(command, args, { shell: shell });
        return new Promise<string>((resolve, reject) => {
            this.logger.info(`Spawn command: ${command} ${args.join(' ')}`);
            let logText = useLogger ? '' : 'Check console for output....';
            const log = (data: string, isError: boolean) => {
                if (useLogger) {
                    logText = logText + `${data}\n`;
                    if (isError) this.logger.warn(Utils.secureString(logPrefix + data));
                    else this.logger.info(Utils.secureString(logPrefix + data));
                } else {
                    console.log(logPrefix + data);
                }
            };

            cmd.stdout.on('data', (data) => {
                log(`${data}`.trim(), false);
            });

            cmd.stderr.on('data', (data) => {
                log(`${data}`.trim(), true);
            });

            cmd.on('error', (error) => {
                log(`${error.message}`.trim(), true);
            });

            cmd.on('exit', (code, signal) => {
                if (code) {
                    log(`Process exited with code ${code} and signal ${signal}`, true);
                    reject(new Error(`Process exited with code ${code}\n${logText}`));
                } else {
                    resolve(logText);
                }
            });

            cmd.on('close', (code) => {
                if (code) {
                    log(`Process closed with code ${code}`, true);
                    reject(new Error(`Process closed with code ${code}\n${logText}`));
                } else {
                    resolve(logText);
                }
            });

            process.on('SIGINT', () => {
                resolve(logText);
            });
        });
    }
    public async pullImage(image: string): Promise<void> {
        Utils.validateIsDefined(image, 'Image must be provided');
        if (RuntimeService.pulledImages.indexOf(image) > -1) {
            return;
        }
        try {
            this.logger.info(`Pulling image ${image}`);
            const stdout = await this.spawn({ command: 'docker', args: ['pull', image], useLogger: true, logPrefix: `${image} ` });
            const outputLines = stdout.toString().split('\n');
            this.logger.info(`Image pulled: ${outputLines[outputLines.length - 2]}`);
            RuntimeService.pulledImages.push(image);
        } catch (e) {
            this.logger.warn(`Image ${image} could not be pulled!`);
        }
    }
    public async getDockerUserGroup(): Promise<string | undefined> {
        const isWin = OSUtils.isWindows();
        if (isWin) {
            return undefined;
        }
        if (RuntimeService.dockerUserId !== undefined) {
            return RuntimeService.dockerUserId;
        }
        try {
            const userId = process?.getuid();
            const groupId = process?.getgid();
            const user = `${userId}:${groupId}`;
            this.logger.info(`User for docker resolved: ${user}`);
            if (userId === 0) {
                this.logger.error('YOU ARE RUNNING BOOTSTRAP AS ROOT!!!! THIS IS NOT RECOMMENDED!!!');
            }
            RuntimeService.dockerUserId = user;
            return user;
        } catch (e) {
            this.logger.info(`User for docker could not be resolved: ${e}`);
            return undefined;
        }
    }

    public async resolveDockerUserFromParam(paramUser: string | undefined): Promise<string | undefined> {
        if (!paramUser || paramUser.trim() === '') {
            return undefined;
        }
        if (paramUser === RuntimeService.CURRENT_USER) {
            return this.getDockerUserGroup();
        }
        return paramUser;
    }
}
