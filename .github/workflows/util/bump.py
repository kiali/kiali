#!/usr/bin/env python3

import sys

release_type = sys.argv[1]
version = sys.argv[2]

parts = version.split('.')

major = int(parts[0][1:])
minor = int(parts[1])
patch = int(parts[2])

if release_type == 'major':
    major = major + 1
    minor = 0
    patch = 0
elif release_type == 'minor':
    minor = minor + 1 
    patch = 0
elif release_type == 'patch':
    patch = patch + 1

print('.'.join(["v" + str(major), str(minor), str(patch)]))