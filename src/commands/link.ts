import { Command, flags } from '@oclif/command';
import { BootstrapService, BootstrapUtils } from '../service';
import { LinkService } from '../service/LinkService';

export default class Link extends Command {
    static description = `It calls a running server announcing all the node transactions like VRF and Voting. This command is useful to link the nodes keys to an existing running network like testnet.`;

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
