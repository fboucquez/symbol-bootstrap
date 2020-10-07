/**
 * Type of a docker compose yml object for reference.
 *
 * Note this type is not complete!
 */

export interface DockerComposeService {
    build?: string;
    image?: string;
    container_name: string;
    restart?: string;
    user?: string;
    working_dir?: string;
    command?: string;
    hostname?: string;
    stop_signal?: string;
    volumes?: string[];
    ports?: string[];
    depends_on?: string[];
    networks?: {
        default: {
            ipv4_address?: string;
            aliases?: string[];
        };
    };
}

export interface DockerCompose {
    version: string;
    networks?: {
        default?: {
            ipam?: {
                config?: [
                    {
                        subnet: string;
                    },
                ];
            };
        };
    };
    services: Record<string, DockerComposeService>;
}
