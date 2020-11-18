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
import * as _ from 'lodash';
import { join } from 'path';
import { Account, NetworkType } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigAccount, ConfigPreset, NodePreset } from '../model';
import { BootstrapUtils, Migration } from './BootstrapUtils';
import { Preset } from './ConfigService';

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class ConfigLoader {
    private static presetInfoLogged = false;

    public static createPresetData(
        root: string,
        preset: Preset,
        assembly: string | undefined,
        customPresetFile: string | undefined,
        customPresetObject: any | undefined,
    ): ConfigPreset {
        const sharedPreset = BootstrapUtils.loadYaml(join(root, 'presets', 'shared.yml'));
        const networkPreset = BootstrapUtils.loadYaml(`${root}/presets/${preset}/network.yml`);
        const assemblyPreset = assembly ? BootstrapUtils.loadYaml(`${root}/presets/${preset}/assembly-${assembly}.yml`) : {};
        const customPreset = customPresetFile ? BootstrapUtils.loadYaml(customPresetFile) : {};
        //Deep merge
        const presetData = _.merge(sharedPreset, networkPreset, assemblyPreset, customPreset, customPresetObject, { preset });
        if (!ConfigLoader.presetInfoLogged) {
            logger.info(`Generating config from preset ${preset}`);
            if (assembly) {
                logger.info(`Assembly preset ${assembly}`);
            }
            if (customPresetFile) {
                logger.info(`Custom preset file ${customPresetFile}`);
            }
        }
        ConfigLoader.presetInfoLogged = true;
        if (presetData.assemblies && !assembly) {
            throw new Error(`Preset ${preset} requires assembly (-a, --assembly option). Possible values are: ${presetData.assemblies}`);
        }
        const presetDataWithDynamicDefaults = {
            version: 1,
            ...presetData,
            nodes: this.dynamicDefaultNodeConfiguration(presetData.nodes),
        };
        return this.expandRepeat(presetDataWithDynamicDefaults);
    }

    public static dynamicDefaultNodeConfiguration(nodes?: NodePreset[]): NodePreset[] {
        return _.map(nodes || [], (node) => {
            const roles = this.resolveRoles(node);
            if (node.harvesting && node.api) {
                return {
                    syncsource: true,
                    filespooling: true,
                    partialtransaction: true,
                    openPort: true,
                    sinkType: 'Async',
                    enableSingleThreadPool: false,
                    brokerOpenPort: true,
                    addressextraction: true,
                    enableAutoSyncCleanup: false,
                    mongo: true,
                    zeromq: true,
                    ...node,
                    roles,
                };
            }
            if (node.harvesting) {
                return {
                    sinkType: 'Sync',
                    enableSingleThreadPool: true,
                    addressextraction: false,
                    mongo: false,
                    zeromq: false,
                    syncsource: true,
                    filespooling: false,
                    enableAutoSyncCleanup: true,
                    partialtransaction: false,
                    ...node,
                    roles,
                };
            }
            if (node.api) {
                return {
                    sinkType: 'Async',
                    syncsource: false,
                    filespooling: true,
                    partialtransaction: true,
                    enableSingleThreadPool: false,
                    addressextraction: true,
                    mongo: true,
                    zeromq: true,
                    enableAutoSyncCleanup: false,
                    ...node,
                    roles,
                };
            }
            throw new Error('A node must have at least one harvesting: true or api: true');
        });
    }
    private static resolveRoles(nodePreset: NodePreset): string {
        if (nodePreset.roles) {
            return nodePreset.roles;
        }
        const roles: string[] = [];
        if (nodePreset.harvesting) {
            roles.push('Peer');
        }
        if (nodePreset.api) {
            roles.push('Api');
        }
        if (nodePreset.voting) {
            roles.push('Voting');
        }
        return roles.join(',');
    }
    public static toConfig(account: Account): ConfigAccount {
        return {
            privateKey: account.privateKey,
            publicKey: account.publicAccount.publicKey,
            address: account.address.plain(),
        };
    }

    public static expandRepeat(presetData: ConfigPreset): ConfigPreset {
        return {
            ...presetData,
            databases: this.expandServicesRepeat(presetData, presetData.databases || []),
            nodes: this.expandServicesRepeat(presetData, presetData.nodes || []),
            gateways: this.expandServicesRepeat(presetData, presetData.gateways || []),
            nemesis: this.applyValueTemplate(presetData, presetData.nemesis),
        };
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static applyValueTemplate(context: any, value: any): any {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return this.expandServicesRepeat(context, value as []);
        }

        if (_.isObject(value)) {
            return _.mapValues(value, (v: any) => this.applyValueTemplate({ ...context, ...value }, v));
        }

        if (!_.isString(value)) {
            return value;
        }
        return BootstrapUtils.runTemplate(value, context);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static expandServicesRepeat(context: any, services: any[]): any[] {
        return _.flatMap(services || [], (service) => {
            if (service.repeat === 0) {
                return [];
            }
            if (!service.repeat) {
                return [service];
            }

            return _.range(service.repeat).map((index) => {
                return _.omit(
                    _.mapValues(service, (v: any) => this.applyValueTemplate({ ...context, ...service, $index: index }, v)),
                    'repeat',
                );
            });
        });
    }

    public static loadExistingPresetDataIfPreset(target: string): ConfigPreset | undefined {
        const generatedPresetLocation = this.getGeneratedPresetLocation(target);
        if (existsSync(generatedPresetLocation)) {
            return BootstrapUtils.loadYaml(generatedPresetLocation);
        }
        return undefined;
    }

    public static loadExistingPresetData(target: string): ConfigPreset {
        const presetData = this.loadExistingPresetDataIfPreset(target);
        if (!presetData) {
            throw new Error(`The file ${this.getGeneratedPresetLocation(target)} doesn't exist. Have you executed the 'config' command?`);
        }
        return presetData;
    }

    public static loadExistingAddressesIfPreset(target: string): Addresses | undefined {
        const generatedAddressLocation = this.getGeneratedAddressLocation(target);
        if (existsSync(generatedAddressLocation)) {
            const presetData = ConfigLoader.loadExistingPresetData(target);
            return this.migrateAddresses(BootstrapUtils.loadYaml(generatedAddressLocation), presetData.networkType);
        }
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static migrateAddresses(addresses: any, networkType: NetworkType | undefined): Addresses {
        const migrations = this.getAddressesMigration(networkType);
        return BootstrapUtils.migrate('addresses.yml', addresses, migrations);
    }

    public static getAddressesMigration(networkType: NetworkType | undefined): Migration[] {
        return [
            {
                description: 'Key names migration',

                migrate(from: any): any {
                    (from.nodes || []).forEach((nodeAddresses: any): any => {
                        if (nodeAddresses.signing) {
                            nodeAddresses.ca = nodeAddresses.signing;
                            nodeAddresses.harvesterSigning = nodeAddresses.signing;
                            delete nodeAddresses.signing;
                        }
                        if (nodeAddresses.node && nodeAddresses.node.address && networkType) {
                            nodeAddresses.node = ConfigLoader.toConfig(
                                Account.createFromPrivateKey(nodeAddresses.node.privateKey, networkType),
                            );
                        }
                        delete nodeAddresses.ssl;
                    });
                    return from;
                },
            },
        ];
    }

    public static loadExistingAddresses(target: string): Addresses {
        const addresses = this.loadExistingAddressesIfPreset(target);
        if (!addresses) {
            throw new Error(`The file ${this.getGeneratedAddressLocation(target)} doesn't exist. Have you executed the 'config' command?`);
        }
        return addresses;
    }

    public static getGeneratedPresetLocation(target: string): string {
        return join(target, 'preset.yml');
    }

    public static getGeneratedAddressLocation(target: string): string {
        return join(target, 'addresses.yml');
    }
}
