#!/bin/bash
set -e


docker compose convert  -c fboucquez_nem_ecs -f target/bootstrap/docker/docker-compose.yml
