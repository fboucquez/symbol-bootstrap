import { Command, flags } from '@oclif/command';
import { ConfigService } from '../service/ConfigService';
import { MongoService } from '../service/MongoService';

export default class Mongo extends Command {
    static description = 'command to start mongo db (NOT WORKING!)';

    static examples = [`$ symbol-bootstrap mongo -p bootstrap`];

    static flags = {
        help: flags.help({ char: 'h', description: 'It shows the help of this command.' }),
        target: flags.string({
            char: 't',
            description: 'the target folder',
            default: ConfigService.defaultParams.target,
        }),
        customPreset: flags.string({
            description: 'External preset file. Values in this file will override the provided presets (optional)',
            required: false,
        }),
        reset: flags.boolean({
            char: 'r',
            description: 'It deletes the database',
            default: false,
        }),
    };

    public run(): Promise<void> {
        const { flags } = this.parse(Mongo);
        return new MongoService(this.config.root, flags).run();
    }
}
