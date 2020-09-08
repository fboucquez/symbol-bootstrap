#!/bin/bash

name=$1
echo "RUNNING startServer.sh $name"
cd /symbol-workdir

ulimit -c unlimited
echo "!!!! Going to start server now...."

exec env LD_LIBRARY_PATH=/usr/catapult/lib:/usr/catapult/deps /usr/catapult/bin/catapult.server ./userconfig
