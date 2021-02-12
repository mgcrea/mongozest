#!/bin/bash

rm -rf node_modules; scripts/runPackages.sh "rm -rf node_modules/"
# yarn install --pure-lockfile --link-duplicates
