#!/bin/bash

export NODE_ENV=production
nohup node index.js > std.out 2> std.err < /dev/null &
