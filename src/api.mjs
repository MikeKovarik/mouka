import {self} from './util.mjs'
import {currentSuite} from './core.mjs'


export var beforeSymbol = Symbol()
export var afterSymbol = Symbol()
export var beforeEachSymbol = Symbol()
export var afterEachSymbol = Symbol()

self.describe = function(name, defineTests) {
	var parentScope = currentSuite._currentFnScope
	parentScope[name] = currentSuite._currentFnScope = {}
	defineTests()
	currentSuite._currentFnScope = parentScope
}

self.it = function(name, test) {
	currentSuite._currentFnScope[name] = test
}

self.before = function(callback) {
	currentSuite._currentFnScope[beforeSymbol] = callback
}

self.after = function(callback) {
	currentSuite._currentFnScope[afterSymbol] = callback
}

self.beforeEach = function(callback) {
	currentSuite._currentFnScope[beforeEachSymbol] = callback
}

self.afterEach = function(callback) {
	currentSuite._currentFnScope[afterEachSymbol] = callback
}
