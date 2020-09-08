#!/bin/bash

name=$1
echo "RUNNING running startBroker.sh $name"

cd /symbol-workdir

ulimit -c unlimited

exec env LD_LIBRARY_PATH=/usr/catapult/lib:/usr/catapult/deps /usr/catapult/bin/catapult.broker ./userconfig
