import { Account, NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses } from '../model';
import { BootstrapUtils, Migration } from './BootstrapUtils';
import { ConfigurationUtils } from './ConfigurationUtils';

export class MigrationService {
    constructor(private readonly logger: Logger) {}
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public migrateAddresses(addresses: any): Addresses {
        const addressesFileName = 'addresses.yml';
        const networkType = addresses.networkType;
        if (!networkType) {
            throw new Error(`networkType must exist on current ${addressesFileName}`);
        }
        const migrations = this.getAddressesMigration(networkType);
        return BootstrapUtils.migrate(this.logger, addressesFileName, addresses, migrations);
    }

    public getAddressesMigration(networkType: NetworkType): Migration[] {
        return [
            {
                description: 'Key names migration',

                migrate(from: any): any {
                    (from.nodes || []).forEach((nodeAddresses: any): any => {
                        if (nodeAddresses.signing) {
                            nodeAddresses.main = nodeAddresses.signing;
                        } else {
                            if (nodeAddresses.ssl) {
                                nodeAddresses.main = ConfigurationUtils.toConfigAccount(
                                    Account.createFromPrivateKey(nodeAddresses.ssl.privateKey, networkType),
                                );
                            }
                        }
                        nodeAddresses.transport = ConfigurationUtils.toConfigAccountFomKeys(
                            networkType,
                            nodeAddresses?.node?.publicKey,
                            nodeAddresses?.node?.privateKey,
                        );
                        if (!nodeAddresses.transport) {
                            nodeAddresses.transport = ConfigurationUtils.toConfigAccount(Account.generateNewAccount(networkType));
                        }
                        delete nodeAddresses.node;
                        delete nodeAddresses.signing;
                        delete nodeAddresses.ssl;
                    });
                    return from;
                },
            },
        ];
    }
}
