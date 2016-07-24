#!/bin/bash

# This is kept in a separate file so we can modify thresholds without changing
# package.json (and thus breaking Docker cache and rerunning "npm install")

# Run this after 'npm test' / 'istanbul cover mocha ...'

# TODO: improve these thresholds

cd "$( dirname "${BASH_SOURCE[0]}" )"
node_modules/.bin/istanbul check-coverage --statement 88 --branch 80 --function 95 --line 93

