import fs from 'fs'


var pkg = fs.readFileSync('package.json')
pkg = JSON.parse(pkg.toString())

var nodeCoreModules = require('repl')._builtinLibs
var dependencies = Object.keys(pkg.dependencies || {})

var external = [...nodeCoreModules, ...dependencies]
var globals = objectFromArray(external)

export default {
	treeshake: false,
	external,
	globals,
	input: 'index.mjs',
	output: {
		file: `index.js`,
		format: 'umd',
	},
	name: pkg.name
}


function objectFromArray(arr) {
	var obj = {}
	arr.forEach(moduleName => obj[moduleName] = moduleName)
	return obj
}