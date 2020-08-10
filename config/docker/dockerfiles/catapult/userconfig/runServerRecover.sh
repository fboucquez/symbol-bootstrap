#!/bin/bash

name=$1
echo "RUNNING runServerRecover.sh $name"
source /userconfig/prepare.sh $name

ulimit -c unlimited

if [ -e "/data/broker.lock" ] || [ -e "/data/server.lock" ]; then
  echo "!!!! Have lock file present, going to run recovery...."
  exec /usr/catapult/bin/catapult.recovery /userconfig
  echo "!!!! Finished running recovery, should be moving on to start server..."
else
  echo "!!!! DO NOT HAVE ANY LOCk FILE.."
  exit 0;
fi

