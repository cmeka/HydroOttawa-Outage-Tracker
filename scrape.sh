#!/bin/bash
dir="/home/ubuntu"
filename=$(date +"%F_%H-%M-%S")
curl 'https://outages.hydroottawa.com/geojson/outage_polygons_public.json' \
  -H 'Accept: application/json' \
  -H 'Referer: https://outages.hydroottawa.com/' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36' \
  --compressed --remote-time --output "${dir}/outages/${filename}.json"

if cmp -s "${dir}/outages/${filename}.json" "${dir}/fetch_last.json"
then
   echo "No change, skipping..."
   rm -f "${dir}/outages/${filename}.json"
else
   echo "The files are different"
   cp "${dir}/outages/${filename}.json" "${dir}/fetch_last.json"
   gzip "${dir}/outages/${filename}.json"
fi