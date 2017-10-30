import {self} from './util.mjs'


export var testsRoot = {}
var currentScope = testsRoot

self.describe = function(name, defineTests) {
	var parentScope = currentScope
	parentScope[name] = currentScope = {}
	defineTests()
	currentScope = parentScope
}

self.it = function(name, test) {
	currentScope[name] = test
}
