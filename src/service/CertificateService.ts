import { ConfigParams } from './ConfigService';
import { BootstrapUtils } from './BootstrapUtils';
import LoggerFactory from '../logger/LoggerFactory';
import Logger from '../logger/Logger';
import { LogType } from '../logger/LogType';
import { join, resolve } from 'path';
import { CertificatePair, ConfigPreset } from '../model';

type CertificateParams = ConfigParams;

const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class CertificateService {
    constructor(private readonly root: string, protected readonly params: CertificateParams) {}

    private getKey(stdout: string, from: string, to: string): string {
        const key = stdout
            .substring(stdout.indexOf(from) + from.length, stdout.indexOf(to))
            .trim()
            .split(':')
            .map((m) => m.trim())
            .join('');
        if (!key || key.length !== 64) {
            throw Error(`SSL Certificate key '${from}' cannot be loaded from the openssl script. Output: \n${stdout}`);
        }
        return key;
    }

    public async run(name: string): Promise<CertificatePair> {
        // Currently the SSL certifcates are created via a docker image. Migrate this to a native forge!
        // https://www.npmjs.com/package/node-forge

        const presetData: ConfigPreset = BootstrapUtils.loadPresetData(
            this.root,
            this.params.preset,
            this.params.assembly,
            this.params.customPreset,
        );
        const symbolServerToolsImage = presetData.symbolServerToolsImage;
        const copyFrom = `${this.root}/config/cert`;
        const target = `${this.params.target}/config/${name}/resources/cert`;
        await BootstrapUtils.mkdir(target);
        await BootstrapUtils.mkdir(join(target, 'new_certs'));
        const generatedContext = { name };
        const templateContext: any = { ...presetData, ...generatedContext };
        await BootstrapUtils.generateConfiguration(templateContext, copyFrom, target);

        const command = this.createCertCommands('/data');
        await BootstrapUtils.writeTextFile(target + '/createCertificate.sh', command);
        const cmd = ['bash', 'createCertificate.sh'];
        const binds = [`${resolve(target)}:/data:rw`];
        const userId = await BootstrapUtils.resolveDockerUserFromParam(this.params.user);
        const { stdout, stderr } = await BootstrapUtils.runImageUsingExec({
            image: symbolServerToolsImage,
            userId: userId,
            workdir: '/data',
            cmds: cmd,
            binds: binds,
        });
        const privateKey = this.getKey(stdout, 'priv:', 'pub:');
        const publicKey = this.getKey(stdout, 'pub:', 'Certificate:');

        logger.info(`Certificate for node ${name} created`);
        if (stdout.indexOf('Certificate Created') < 0) {
            logger.info(stdout);
            logger.error(stderr);
            throw new Error('Certificate creation failed. Check the logs!');
        }

        return { privateKey, publicKey };
    }

    private createCertCommands(target: string): string {
        return `
cd ${target}
set -e
chmod 700 new_certs
touch index.txt.attr
touch index.txt

# create CA key
openssl genpkey -out ca.key.pem -outform PEM -algorithm ed25519
openssl pkey -inform pem -in ca.key.pem -text -noout
openssl pkey -in ca.key.pem -pubout -out ca.pubkey.pem

# create CA cert and self-sign it
openssl req -config ca.cnf -keyform PEM -key ca.key.pem -new -x509 -days 7300 -out ca.cert.pem
openssl x509 -in ca.cert.pem  -text -noout

# create node key
openssl genpkey -out node.key.pem -outform PEM -algorithm ed25519
openssl pkey -inform pem -in node.key.pem -text -noout

# create request
openssl req -config node.cnf -key node.key.pem -new -out node.csr.pem
openssl req  -text -noout -verify -in node.csr.pem

### below is done after files are written
# CA side
# create serial
openssl rand -hex 19 > ./serial.dat

# sign cert for 375 days
openssl ca -batch -config ca.cnf -days 375 -notext -in node.csr.pem -out node.crt.pem
openssl verify -CAfile ca.cert.pem node.crt.pem

# finally create full crt
cat node.crt.pem ca.cert.pem > node.full.crt.pem
echo "Certificate Created"
`;
    }
}
