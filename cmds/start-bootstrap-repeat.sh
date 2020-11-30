#!/bin/bash
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
symbol-bootstrap start -p bootstrap -c test/repeat_preset.yml -t target/bootstrap-repeat $1 $2 $3
