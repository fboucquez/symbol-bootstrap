import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigPreset } from '../model';
import { join } from 'path';
import { promises as fsPromises, readFileSync } from 'fs';
export type ReportParams = { target: string };

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ReportService {
    public static defaultParams: ReportParams = {
        target: 'target',
    };

    constructor(private readonly root: string, protected readonly params: ReportParams) {}

    /**
     *  It generates a .rst config report file per node.
     * @param passedPresetData the preset data,
     */
    public async run(passedPresetData?: ConfigPreset): Promise<string[]> {
        const presetData = passedPresetData ?? BootstrapUtils.loadExistingPresetData(this.params.target);

        const workingDir = process.cwd();
        const target = join(workingDir, this.params.target);
        const descriptions = await BootstrapUtils.loadYaml(join(this.root, 'presets', 'descriptions.yml'));
        const reportFolder = join(this.params.target, 'report');
        BootstrapUtils.deleteFolder(reportFolder);
        const promises = (presetData.nodes || []).map(async (n) => {
            const resourcesFolder = join(target, 'config', n.name, 'resources');
            const files = await fsPromises.readdir(resourcesFolder);

            await BootstrapUtils.mkdir(reportFolder);
            const reportFile = join(reportFolder, `${n.name}-config.rst`);

            const reportContent = files
                .filter((f) => f.indexOf('.properties') > -1)
                .map((f) => {
                    let resourceContent = readFileSync(join(resourcesFolder, f), 'utf-8');
                    resourceContent = resourceContent.replace(/\[(.*?)\]\n/g, (a, b) => {
                        return `**${b}**; ; ;\n`;
                    });

                    resourceContent = resourceContent.replace(/(.*?) = (.*?)\n/g, (a, b, c) => {
                        const description = descriptions[b];
                        return `${b}; ${description?.type || ''} ; ${description?.description || ''} ;${c}\n`;
                    });

                    resourceContent = resourceContent.replace(/\#.*?\n/g, ``);
                    resourceContent = resourceContent.replace(/(^[ \t]*\n)/gm, '');

                    return `
${f}
${f.replace(/./g, '=')}
.. csv-table::
    :header: "Property", "Type", "Description", "Value"
    :delim: ;

${resourceContent.trim().replace(/^/gm, '    ')}`;
                })
                .join('\n');

            await BootstrapUtils.writeTextFile(reportFile, reportContent);
            logger.info(`Report file ${reportFile} created`);
            return reportFile;
        });
        return Promise.all(promises);
    }
}
