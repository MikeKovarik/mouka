(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.mouka = {})));
}(this, (function (exports) { 'use strict';

var timeout = (millis = 0) => new Promise(resolve => setTimeout(resolve, millis));

var self = typeof global === 'object' ? global : window;

var isNode = typeof process === 'object' && process.versions.node;

;
if (isNode) {
	exports.cwd = process.cwd();
} else if (typeof Windows !== 'undefined') {
	let installPath = Windows.ApplicationModel.Package.current.installedLocation.path;
	// get rid of bin/debug/appx
	let split = installPath.split('\\').slice(0, -3);
	// assume the tests are in 'test' directory. TODO: add some api for specifying (or hooking into test's currentScript.href)
	split.push('test');
	exports.cwd = split.join('\\');
}

var SCOPE_SYMBOL = '>|';
var TEST_SYMBOL = '#|';

function redirectConsoleTo(logNode) {

	var _log = console.log.bind(console);
	var _error = console.error.bind(console);

	function wrapLog(args) {
		return args
			.map(item => {
				if (item === null)
					return 'null'
				if (item === undefined)
					return 'undefined'
				return item.toString()
			})
			.join(' ')
			+ '\n'
	}

	console.log = function log(...args) {
		_log(...args);
		logNode.textContent += wrapLog(args);
	};

	console.error = function error(...args) {
		_error(...args);
		logNode.textContent += wrapLog(args);
		//logNode.textContent += '<span style="color: red">' + wrapLog(args) + '</span>'
	};

}

// Copy Error's contents into a new object that can be stringified
function sanitizeError(err) {
	//var {errno, code, syscall, path, message} = err
	//return {errno, code, syscall, path, message}
	var {message} = err;
	var newErr = {message};
	Object.keys(err)
		.forEach(key => newErr[key] = err[key]);
	return newErr
}

function stringify(data) {
	try {
		if (data === null)
			return null
		if (data && Array.isArray(data))
			return JSON.stringify(data)
		else
			return JSON.stringify(data, null, 2)
	} catch(e) {
		return '--- unable to stringify ---'
	}
}

// TODO: rewrite to to not use JSON
function objectsEqual(a, b) {
	try {
		return JSON.stringify(a) === JSON.stringify(b)
	} catch(e) {
		console.log(e);
	}
}

function traversePath(path, root) {
	path.slice(0);
	var scope = root;
	while (path.length && scope !== undefined)
		scope = scope[path.shift()];
	return scope
}

var testsRoot = {};
var currentScope = testsRoot;

self.describe = function(name, defineTests) {
	var parentScope = currentScope;
	parentScope[name] = currentScope = {};
	defineTests();
	currentScope = parentScope;
};

self.it = function(name, test) {
	currentScope[name] = test;
};

async function execute() {
	try {
		return executeScope(undefined, testsRoot)
	} catch(err) {
		throw 'Something went wrong during execution of the test cases.' + ' ' + err.message
	}
}

async function executeScope(scopeName, tests) {
	if (scopeName) {
		console.log('#########################');
		console.log('running scope:', scopeName);
	}
	var output = {};
	for (var [testName, test] of Object.entries(tests)) {
		if (typeof test === 'object')
			output[SCOPE_SYMBOL + testName] = await executeScope(testName, test);
		else
			output[TEST_SYMBOL + testName] = await executeTest(testName, test);
	}
	return output
}

async function executeTest(testName, test) {
	console.log('-------------------------');
	console.log('running test:', testName);
	try {
		var result = await test();
		console.log(result);
		return result
	} catch(err) {
		//console.error(`Error occured while running '${testName}'`)
		console.error(err);
		return sanitizeError(err)
	}
}



// COMPARATION OF TWO LOGS

var compare = compareScope;

function compareScope(mainLog, secondaryLog) {
	var output = {};
	for (var [name, desiredResult] of Object.entries(mainLog)) {
		if (secondaryLog[name] === undefined)
			continue
		if (name.startsWith(SCOPE_SYMBOL))
			output[name] = compareScope(desiredResult, secondaryLog[name]);
		else if (name.startsWith(TEST_SYMBOL))
			output[name] = compareTest(name, desiredResult, secondaryLog[name]);
	}
	return output
}

function compareTest(testName, desiredResult, actualResult) {
	if (objectsEqual(desiredResult, actualResult))
		return true
	else
		return [actualResult, desiredResult]
}


// RENDERING RESULT OF LOGS

var render = renderScope.bind(undefined, undefined);

function renderScope(scopeName, scope, path = []) {
	var fragment = document.createDocumentFragment();
	if (scopeName) {
		var nameNode = document.createElement('h4');
		nameNode.textContent = scopeName;
		fragment.appendChild(nameNode);
	}
	for (var [name, result] of Object.entries(scope)) {
		let symbol = name.slice(0, 2);
		name = name.slice(2);
		if (symbol === SCOPE_SYMBOL)
			var testFragment = renderScope(name, result, [...path, name]);
		else if (symbol === TEST_SYMBOL)
			var testFragment = renderTest(name, result, [...path, name]);
		fragment.appendChild(testFragment);
	}
	return fragment
}

function renderTest(testName, testResult, path) {
	var fragment = document.createDocumentFragment();
	var nameNode = document.createElement('div');
	nameNode.textContent = testName;
	nameNode.style.color = testResult === true ? 'green' : 'red';
	fragment.appendChild(nameNode);
	if (testResult === true)
		return fragment
	var [actualValue, desiredValue] = testResult;
	var codePre = document.createElement('pre');
	var test = traversePath(path, testsRoot);
	codePre.textContent = test.toString();
	var div1 = document.createElement('div');
	var div2 = document.createElement('div');
	div1.textContent = 'result is:';
	div2.textContent = 'should be:';
	var pre1 = document.createElement('pre');
	var pre2 = document.createElement('pre');
	pre1.textContent = stringify(actualValue);
	pre2.textContent = stringify(desiredValue);
	fragment.appendChild(codePre);
	fragment.appendChild(div1);
	fragment.appendChild(pre1);
	fragment.appendChild(div2);
	fragment.appendChild(pre2);
	return fragment
}

var exportFileName = 'mouka-results.json';
var setExportName = newName => exportFileName = newName;

var run = isNode ? runAsCli : runAsBroswer;

if (isNode)
	runAsCli();

async function runAsCli() {
	console.log('runAsCli');
	// TODO - change 2 to 1
	var testFileName = process.argv[2];
	// import test file
	await timeout();
	try {
		require(`${process.cwd()}/${testFileName}.mjs`);
	} catch(e) {
		require(`${process.cwd()}/${testFileName}.js`);
	}
	execute()
		.then(stringifyLog)
		.then(exportLog)
		.catch(err => console.error(err));
}

async function runAsBroswer(outputElement) {
	var promises = [importLog(), execute()];
	var [nodeLog, browserLog] = await Promise.all(promises);
	var result = compare(nodeLog, browserLog);
	var fragment = render(result);
	if (outputElement)
		outputElement.appendChild(fragment);
	return fragment
}



const COULD_NOT_LOAD_MSG = 'Pre-existing logs not found. Tests were not previously ran against Node.';

async function importLog() {
	return fetch(`./${exportFileName}`)
		.then(onFetchResponse)
		.then(res => res.json())
		.catch(err => {throw new Error(COULD_NOT_LOAD_MSG)})
}

function onFetchResponse(response) {
	if (response.ok)
		return response
	else
		throw new Error(`not found ${response.url}`)
}

async function stringifyLog(log) {
	return JSON.stringify(log, null, 4)
}

async function exportLog(json) {
	var fs = require('fs');
	var util = require('util');
	var path = require('path');
	var exportFilePath = path.join(process.cwd(), exportFileName);
	var writeFile = util.promisify(fs.writeFile);
	console.log('exportFilePath', exportFilePath);
	return writeFile(exportFilePath, json)
}

//import def from './src/index.mjs'
//export default def

exports.timeout = timeout;
exports.self = self;
exports.isNode = isNode;
exports.SCOPE_SYMBOL = SCOPE_SYMBOL;
exports.TEST_SYMBOL = TEST_SYMBOL;
exports.redirectConsoleTo = redirectConsoleTo;
exports.sanitizeError = sanitizeError;
exports.stringify = stringify;
exports.objectsEqual = objectsEqual;
exports.traversePath = traversePath;
exports.setExportName = setExportName;
exports.run = run;
exports.runAsCli = runAsCli;
exports.runAsBroswer = runAsBroswer;
exports.execute = execute;
exports.compare = compare;
exports.render = render;

Object.defineProperty(exports, '__esModule', { value: true });

})));
