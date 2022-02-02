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
import * as os from 'os';
import * as semver from 'semver';
import { Logger } from '../logger';
import { OSUtils } from './OSUtils';
import { RuntimeService } from './RuntimeService';
import { Utils } from './Utils';
export interface VerifyReport {
    platform: string;
    lines: ReportLine[];
}

export interface ReportLine {
    header: string;
    message: string;
    recommendation?: string;
}

export interface ExpectedVersions {
    node: string;
    docker: string;
    dockerCompose: string;
}

const defaultExpectedVersions: ExpectedVersions = {
    node: '12.0.0',
    docker: '18.3.0',
    dockerCompose: '1.25.0',
};

export interface VerifyAction {
    shouldRun(lines: ReportLine[]): boolean;
    verify(): Promise<ReportLine>;
}

export class AppVersionService {
    public static readonly semverOptions = { loose: true };
    constructor(private readonly logger: Logger, private readonly runtimeService: RuntimeService) {}
    public loadVersion(text: string): string | undefined {
        return text
            .replace(',', '')
            .split(' ')
            .map((word) => {
                const coerce = semver.coerce(word.trim(), AppVersionService.semverOptions);
                return coerce?.raw;
            })
            .find((a) => a)
            ?.trim();
    }

    public async loadVersionFromCommand(command: string): Promise<string | undefined> {
        return this.loadVersion((await this.runtimeService.exec(command)).stdout.trim());
    }

    public async verifyInstalledApp(
        versionLoader: () => Promise<string | undefined>,
        header: string,
        minVersion: string,
        recommendationUrl: string,
    ): Promise<ReportLine> {
        const recommendationPrefix = `At least version ${minVersion} is required.`;
        const recommendationSuffix = `Check ${recommendationUrl}`;
        try {
            const version = await versionLoader();
            if (!version) {
                return {
                    header,
                    message: `Version could not be found! Output: ${versionLoader}`,
                    recommendation: `${recommendationPrefix} ${recommendationSuffix}`,
                };
            }
            if (semver.lt(version, minVersion, AppVersionService.semverOptions)) {
                return {
                    header,
                    message: version,
                    recommendation: `${recommendationPrefix} Currently installed version is ${version}. ${recommendationSuffix}`,
                };
            }
            return { header, message: version };
        } catch (e) {
            return {
                header,
                message: `Error: ${Utils.getMessage(e)}`,
                recommendation: `${recommendationPrefix} ${recommendationSuffix}`,
            };
        }
    }
}

export class AppVersionVerifyAction implements VerifyAction {
    constructor(
        readonly service: AppVersionService,
        readonly params: {
            header: string;
            version?: string;
            command?: string;
            recommendationUrl: string;
            expectedVersion: string;
        },
    ) {}

    verify(): Promise<ReportLine> {
        return this.service.verifyInstalledApp(
            async () => {
                if (this.params.version) {
                    return this.params.version;
                }
                if (this.params.command) {
                    return this.service.loadVersionFromCommand(this.params.command);
                }
                throw new Error('Either version or command must be provided!');
            },
            this.params.header,
            this.params.expectedVersion,
            this.params.recommendationUrl,
        );
    }

    shouldRun(): boolean {
        return true;
    }
}

export class DockerRunVerifyAction implements VerifyAction {
    constructor(private readonly logger: Logger, private readonly runtimeService: RuntimeService) {}
    async verify(): Promise<ReportLine> {
        const header = 'Docker Run Test';
        const command = 'docker run hello-world';
        const recommendationUrl = `https://www.digitalocean.com/community/questions/how-to-fix-docker-got-permission-denied-while-trying-to-connect-to-the-docker-daemon-socket`;

        try {
            const output = (await this.runtimeService.exec(command)).stdout.trim();
            const expectedText = 'Hello from Docker!';
            if (output.indexOf(expectedText) == -1) {
                return {
                    header,
                    message: `Command '${command}' could not be executed: Error: '${expectedText}' not in output text \n${output}`,
                    recommendation: `Please check ${recommendationUrl}`,
                };
            }
            return { header, message: `Command '${command}' executed!` };
        } catch (e) {
            return {
                header,
                message: `Command '${command}' could not be executed: Error: ${Utils.getMessage(e)}`,
                recommendation: `Please check ${recommendationUrl}`,
            };
        }
    }
    shouldRun(lines: ReportLine[]): boolean {
        return !!lines.find((l) => l.header === 'Docker Version' && !l.recommendation);
    }
}

export class SudoRunVerifyAction implements VerifyAction {
    async verify(): Promise<ReportLine> {
        const header = 'Sudo User Test';
        if (OSUtils.isRoot()) {
            return {
                header,
                message: `Your are running with the sudo user!`,
                recommendation: `Either don't use sudo or create a non sudo user to run Bootstrap.`,
            };
        }
        return { header, message: `Your are not the sudo user!` };
    }
    shouldRun(): boolean {
        return !OSUtils.isWindows();
    }
}

export class VerifyService {
    private readonly expectedVersions: ExpectedVersions;
    public static readonly currentNodeJsVersion = process.versions.node;
    public readonly actions: VerifyAction[] = [];
    private readonly runtimeService: RuntimeService;

    constructor(private readonly logger: Logger, expectedVersions: Partial<ExpectedVersions> = {}) {
        this.runtimeService = new RuntimeService(logger);
        this.expectedVersions = { ...defaultExpectedVersions, ...expectedVersions };

        const appVersionService = new AppVersionService(this.logger, this.runtimeService);
        this.actions.push(
            new AppVersionVerifyAction(appVersionService, {
                header: 'NodeVersion',
                version: VerifyService.currentNodeJsVersion,
                recommendationUrl: `https://nodejs.org/en/download/package-manager/`,
                expectedVersion: this.expectedVersions.node,
            }),
        );
        this.actions.push(
            new AppVersionVerifyAction(appVersionService, {
                header: 'Docker Version',
                command: 'docker --version',
                recommendationUrl: `https://docs.docker.com/get-docker/`,
                expectedVersion: this.expectedVersions.docker,
            }),
        );

        this.actions.push(
            new AppVersionVerifyAction(appVersionService, {
                header: 'Docker Compose Version',
                command: 'docker-compose --version',
                recommendationUrl: `https://docs.docker.com/compose/install/`,
                expectedVersion: this.expectedVersions.dockerCompose,
            }),
        );
        this.actions.push(new DockerRunVerifyAction(this.logger, this.runtimeService));
        this.actions.push(new SudoRunVerifyAction());
    }

    public async createReport(): Promise<VerifyReport> {
        const lines: ReportLine[] = [];
        const platform = `${os.type()} - ${os.release()} - ${os.platform()}`;
        for (const action of this.actions) {
            if (action.shouldRun(lines)) lines.push(await action.verify());
        }
        return { lines, platform };
    }

    public logReport(report: VerifyReport): void {
        this.logger.info(`OS: ${report.platform}`);
        report.lines.forEach((line) => {
            if (line.recommendation) {
                this.logger.error(`${line.header}  - Error! - ${line.message} - ${line.recommendation}`);
            } else {
                this.logger.info(`${line.header} - OK! - ${line.message}`);
            }
        });
    }

    public validateReport(report: VerifyReport): void {
        const errors = report.lines.filter((r) => r.recommendation);
        if (errors.length) {
            throw new Error(
                'There has been an error. Check the report:\n' +
                    errors.map((line) => ` - ${line.header}  - Error! - ${line.message} - ${line.recommendation}`).join('\n'),
            );
        }
    }
}
