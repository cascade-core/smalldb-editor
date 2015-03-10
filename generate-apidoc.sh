#!/bin/sh

# download jsdoc3 documentation generator
[[ -d ./jsdoc ]] || git clone git@github.com:jsdoc3/jsdoc.git

# run for all scripts inside js directory
./jsdoc/jsdoc js/ \
	--template jsdoc/templates/default \
	--private \
	--recurse \
	--destination api \
	--readme README.md
