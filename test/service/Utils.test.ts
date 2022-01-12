import { expect } from '@oclif/test';
import { it } from 'mocha';
import { Utils } from '../../src';

describe('Utils', () => {
    it('secureString', () => {
        expect(
            Utils.secureString(
                '--secret=9F9D35D4BFA630012F074AAE11CF12191105EBA1435036FEF6AFAD8088918A62 --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
            ),
        ).to.be.eq('--secret=HIDDEN_KEY --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n');

        expect(
            Utils.secureString(
                'Running image using Exec: symbolplatform/symbol-server:tools-gcc-0.10.0.5 /usr/catapult/bin/catapult.tools.votingkey --secret=9F9D35D4BFA630012F074AAE11CF12191105EBA1435036FEF6AFAD8088918A62 --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
            ),
        ).to.be.eq(
            'Running image using Exec: symbolplatform/symbol-server:tools-gcc-0.10.0.5 /usr/catapult/bin/catapult.tools.votingkey --secret=HIDDEN_KEY --startEpoch=1 --endEpoch=26280 --output=/votingKeys/private_key_tree1.dat\n',
        );
    });
});
