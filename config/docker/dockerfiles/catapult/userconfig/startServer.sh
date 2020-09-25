#!/bin/bash

name=$1
echo "RUNNING startServer.sh $name"
source /userconfig/prepare.sh $name
id -a

sleep 4
cd /data
mkdir -p startup
rm -f /data/startup/mongo-initialized
touch /data/startup/datadir-initialized

echo "!!!! Going to start server now...."

exec env LD_LIBRARY_PATH=/usr/catapult/lib:/usr/catapult/deps /usr/catapult/bin/catapult.server /userconfig
