#!/bin/bash

name=$1
echo "RUNNING running startBroker.sh $name"
source /userconfig/prepare.sh $name

ulimit -c unlimited

if [ -e "/state/$name" ]; then
  rm -f "/state/$name"
fi

#cd /catapult
id -a
ls -alh /data
cd /data
rm /data/startup/datadir-initialized

touch "/state/$name"

exec /usr/catapult/bin/catapult.broker /userconfig
