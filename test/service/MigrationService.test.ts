import { expect } from 'chai';
import { describe } from 'mocha';
import { Addresses, BootstrapUtils, LoggerFactory, LogType } from '../../src';
import { MigrationService } from '../../src/service/MigrationService';
const logger = LoggerFactory.getLogger(LogType.Silent);
describe('MigrationService', () => {
    it('should migrated old addresses', async () => {
        const service = new MigrationService(logger);
        const oldAddresses = (await BootstrapUtils.loadYaml('./test/addresses/addresses-old.yml', false)) as Addresses;
        const newAddresses = (await BootstrapUtils.loadYaml('./test/addresses/addresses-new.yml', false)) as Addresses;
        const addresses = service.migrateAddresses(oldAddresses);
        newAddresses.nodes![1].transport = addresses.nodes![1]!.transport;
        expect(addresses).to.be.deep.eq(newAddresses);
    });

    it('should migrated not migrate new addresses', async () => {
        const service = new MigrationService(logger);
        const newAddresses = BootstrapUtils.loadYaml('./test/addresses/addresses-new.yml', false) as Addresses;
        const addresses = service.migrateAddresses(newAddresses) as Addresses;
        expect(addresses).to.be.deep.eq(newAddresses);
    });
});
