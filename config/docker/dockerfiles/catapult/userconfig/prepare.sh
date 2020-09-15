sleep 4

name=$1
echo "RUNNING prepare.sh $name"

if [ ! -d /data ]; then
  echo "/data directory does not exist"
  exit 1
fi

if [ ! -d /data/00000 ]; then
    if  [ ! -d /nemesis-data/seed/00000 ]; then
      echo "nemgen boostrap needs to be run"
      exit 1
    fi
    echo "copying nemesis data"
    cp -r /nemesis-data/seed/* /data*
fi

if  [ ! -d /data/00000 ]; then
   echo "Nemesis could not be found!"
  exit 1
fi

if [ ! -f "/data/index.dat" ]; then
  echo "No index.dat file, creating now...."
  echo -ne "\01\0\0\0\0\0\0\0" > /data/index.dat
fi

