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

import { promises as fsPromises, readFileSync } from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import { Logger } from '../logger';
import { ConfigPreset } from '../model';
import { ConfigLoader } from './ConfigLoader';
import { Constants } from './Constants';
import { FileSystemService } from './FileSystemService';
import { YamlUtils } from './YamlUtils';

export type ReportParams = { target: string; workingDir: string; version?: string };

interface ReportLine {
    property: string;
    type: string;
    description: string;
    hidden: boolean;
    value: string;
}

interface ReportSection {
    header: string;
    lines: ReportLine[];
}

interface ReportFile {
    fileName: string;
    sections: ReportSection[];
}

interface ReportNode {
    name: string;
    files: ReportFile[];
}

export class ReportService {
    public static defaultParams: ReportParams = {
        target: Constants.defaultTargetFolder,
        workingDir: Constants.defaultWorkingDir,
    };
    private readonly configLoader: ConfigLoader;
    private readonly fileSystemService: FileSystemService;
    constructor(private readonly logger: Logger, protected readonly params: ReportParams) {
        this.configLoader = new ConfigLoader(logger);
        this.fileSystemService = new FileSystemService(logger);
    }

    private createReportFromFile(resourceContent: string, descriptions: any): ReportSection[] {
        const sections: ReportSection[] = [];

        const lines = resourceContent
            .trim()
            .split(/\s*[\r\n]+\s*/g)
            .map((l) => l.trim())
            .filter((l) => l && l.indexOf('#') != 0);

        lines.forEach((l) => {
            const isHeader = /\[([\w\s\.:]+)]/.exec(l);
            if (isHeader && isHeader.length && isHeader[1]) {
                sections.push({
                    header: isHeader[1],
                    lines: [],
                });
            } else {
                const isProperty = /(.*)=(.*)/.exec(l);
                if (isProperty && isProperty.length && isProperty[1]) {
                    const propertyName = isProperty[1].trim();
                    const descriptor = descriptions[propertyName];
                    const hidden = (descriptor && descriptor.hidden) || false;
                    const value = isProperty[2].trim();
                    const section = sections[sections.length - 1];
                    if (!section) {
                        throw new Error(`Invalid line '${l}'. No section could be found!`);
                    }
                    section.lines.push({
                        property: propertyName,
                        value: hidden ? value.replace(/./g, '*') : value,
                        hidden: hidden,
                        description: (descriptor && descriptor.description) || '',
                        type: (descriptor && descriptor.type) || '',
                    });
                }
            }
        });

        return sections;
    }

    private async createReportsPerNode(presetData: ConfigPreset): Promise<ReportNode[]> {
        const workingDir = process.cwd();
        const target = join(workingDir, this.params.target);
        const descriptions = await YamlUtils.loadYaml(join(Constants.ROOT_FOLDER, 'presets', 'descriptions.yml'), false);
        const promises: Promise<ReportNode>[] = (presetData.nodes || []).map(async (n) => {
            const resourcesFolder = join(this.fileSystemService.getTargetNodesFolder(target, false, n.name), 'server-config', 'resources');
            const files = await fsPromises.readdir(resourcesFolder);
            const reportFiles = files
                .filter((fileName) => fileName.indexOf('.properties') > -1)
                .map((fileName) => {
                    const resourceContent = readFileSync(join(resourcesFolder, fileName), 'utf-8');
                    const sections = this.createReportFromFile(resourceContent, descriptions);
                    return {
                        fileName,
                        sections,
                    };
                });
            return {
                name: n.name,
                files: reportFiles,
            };
        });

        return Promise.all(promises);
    }

    /**
     *  It generates a .rst config report file per node.
     * @param passedPresetData the preset data,
     */
    public async run(passedPresetData?: ConfigPreset): Promise<string[]> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, false);

        const reportFolder = join(this.params.target, 'reports');
        this.fileSystemService.deleteFolder(reportFolder);
        const reportNodes: ReportNode[] = await this.createReportsPerNode(presetData);

        const missingProperties = _.flatMap(reportNodes, (n) =>
            _.flatMap(n.files, (f) =>
                _.flatMap(f.sections, (section) =>
                    section.lines
                        .filter((line) => !line.type && !line.description && !line.property.startsWith('starting-at-height'))
                        .map((line) => line.property),
                ),
            ),
        );
        const missingDescriptions = _.uniq(missingProperties);
        if (missingDescriptions.length) {
            const missingDescriptionsObject = _.mapValues(
                _.keyBy(missingProperties, (k) => k),
                () => ({
                    type: '',
                    description: '',
                }),
            );
            this.logger.debug('Missing yaml properties: ' + YamlUtils.toYaml(missingDescriptionsObject));
        }

        // const missingDescriptions = reportNodes.map(node -> node.files)

        await this.fileSystemService.mkdir(reportFolder);
        const version = this.getVersion(presetData);
        const promises = _.flatMap(reportNodes, (n) => {
            return [this.toRstReport(reportFolder, version, n), this.toCsvReport(reportFolder, version, n)];
        });
        return Promise.all(promises);
    }

    private getVersion(passedPresetData: ConfigPreset | undefined): string {
        return this.params.version || passedPresetData?.reportBootstrapVersion || Constants.VERSION;
    }

    private async toRstReport(reportFolder: string, version: string, n: ReportNode) {
        const reportFile = join(reportFolder, `${n.name}-config.rst`);
        const reportContent =
            `Symbol Bootstrap Version: ${version}\n` +
            n.files
                .map((fileReport) => {
                    const hasDescriptionSection = fileReport.sections.find((s) => s.lines.find((l) => l.description || l.type));
                    const header = hasDescriptionSection ? '"Property", "Value", "Type", "Description"' : '"Property", "Value"';
                    const csvBody = fileReport.sections
                        .map((s) => {
                            const hasDescriptionValueSection = s.lines.find((l) => l.description || l.type);
                            return (
                                (hasDescriptionValueSection ? `**${s.header}**; ; ;\n` : `**${s.header}**;\n`) +
                                s.lines
                                    .map((l) => {
                                        if (hasDescriptionValueSection)
                                            return `${l.property}; ${l.value}; ${l.type}; ${l.description}`.trim() + '\n';
                                        else {
                                            return `${l.property}; ${l.value}`.trim() + '\n';
                                        }
                                    })
                                    .join('')
                            );
                        })
                        .join('');

                    return `
${fileReport.fileName}
${fileReport.fileName.replace(/./g, '=')}
.. csv-table::
    :header: ${header}
    :delim: ;

${csvBody.trim().replace(/^/gm, '    ')}`;
                })
                .join('\n');

        await YamlUtils.writeTextFile(reportFile, reportContent);
        this.logger.info(`Report file ${reportFile} created`);
        return reportFile;
    }

    private async toCsvReport(reportFolder: string, version: string | undefined, n: ReportNode) {
        const reportFile = join(reportFolder, `${n.name}-config.csv`);
        const reportContent =
            `symbol-bootstrap-version; ${version}\n\n` +
            n.files
                .map((fileReport) => {
                    const csvBody = fileReport.sections
                        .map((s) => {
                            const hasDescriptionSection = s.lines.find((l) => l.description || l.type);
                            return (
                                `${s.header}\n` +
                                s.lines
                                    .map((l) => {
                                        if (hasDescriptionSection)
                                            return `${l.property}; ${l.value}; ${l.type}; ${l.description}`.trim() + '\n';
                                        else {
                                            return `${l.property}; ${l.value}`.trim() + '\n';
                                        }
                                    })
                                    .join('')
                            );
                        })
                        .join('\n');

                    return `${fileReport.fileName}
${csvBody.trim()}`;
                })
                .join('\n\n\n');

        await YamlUtils.writeTextFile(reportFile, reportContent);
        this.logger.info(`Report file ${reportFile} created`);
        return reportFile;
    }
}
