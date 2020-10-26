#!/bin/bash
set -e

sleep 1
database=$1
echo "Setting up database $database"
while true;
do
        mongo --eval "db.runCommand( { serverStatus: 1 } )" $database/local > /dev/null 2>&1
        if [ $? -eq 0 ]; then
                break;
        fi
        echo "waiting for mongod start..."
        sleep 1
done

echo " [+] Preparing $database"
cd /userconfig
mongo "$database/catapult" < mongoDbPrepare.js
echo " [.] (exit code: $?)"
cd -

echo " [+] $database prepared, checking account indexes"
mongo --eval 'db.accounts.getIndexes()' "$database/catapult"

trap 'echo "successful; exiting"; exit 0' SIGTERM


