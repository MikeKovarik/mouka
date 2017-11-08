import {self} from './util.mjs'


export var testsRoot = {}
var currentScope = testsRoot

export var beforeSymbol = Symbol()
export var afterSymbol = Symbol()
export var beforeEachSymbol = Symbol()
export var afterEachSymbol = Symbol()

self.describe = function(name, defineTests) {
	var parentScope = currentScope
	parentScope[name] = currentScope = {}
	defineTests()
	currentScope = parentScope
}

self.it = function(name, test) {
	currentScope[name] = test
}

self.before = function(callback) {
	currentScope[beforeSymbol] = callback
}

self.after = function(callback) {
	currentScope[afterSymbol] = callback
}

self.beforeEach = function(callback) {
	currentScope[beforeEachSymbol] = callback
}

self.afterEach = function(callback) {
	currentScope[afterEachSymbol] = callback
}
