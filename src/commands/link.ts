import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils, ComposeService } from '../service';
import { LinkService } from '../service/LinkService';

export default class Link extends Command {
    static description = `It announces VRF and Voting Link transactions to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.`;

    static examples = [`$ symbol-bootstrap link`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: LinkService.defaultParams.target,
        }),
        url: flags.string({
            char: 'u',
            description: 'the network url',
            default: LinkService.defaultParams.url,
        }),
        unlink: flags.boolean({
            description: 'Perform "Unlink" transactions unlinking the voting and VRF keys from the node signer account',
            default: ComposeService.defaultParams.reset,
        }),
        maxFee: flags.integer({
            description: 'the max fee used when announcing',
            default: LinkService.defaultParams.maxFee,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = this.parse(Link);
        BootstrapUtils.showBanner();
        return new BootstrapService(this.config.root).link(flags);
    }
}
