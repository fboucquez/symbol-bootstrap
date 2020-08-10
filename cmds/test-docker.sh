#!/bin/bash
set -e

sudo ./cmds/clean-all.sh
bin/run config -r


docker network create --subnet  172.21.0.0/24 symbol-network

dir=$(pwd)
echo $dir
docker run \
--workdir /data \
--user "$(id -u):$(id -g)" \
-v "${dir}/target/config/generated-addresses:/addresses"  \
-v "${dir}/target/config/peer-node-0:/userconfig"  \
-v "${dir}/target/config/nemesis:/nemesis"  \
-v "${dir}/target/data/nemesis-data:/data:rw" \
-v "${dir}/target/state:/state"  \
-t symbolplatform/symbol-server:tools-gcc-0.9.6.4 \
bash -c "find . && /usr/catapult/bin/catapult.tools.nemgen  -r /userconfig --nemesisProperties /nemesis/block-properties-file.properties"
