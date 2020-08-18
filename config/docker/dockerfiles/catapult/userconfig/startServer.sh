#!/bin/bash

name=$1
echo "RUNNING startServer.sh $name"
source /userconfig/prepare.sh $name
id -a

sleep 4
cd /data
find .
mkdir -p startup
rm -f /data/startup/mongo-initialized
touch /data/startup/datadir-initialized

echo "!!!! Going to start server now...."

exec /usr/catapult/bin/catapult.server /userconfig
