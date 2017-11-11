(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('fs'), require('util'), require('path')) :
	typeof define === 'function' && define.amd ? define(['exports', 'fs', 'util', 'path'], factory) :
	(factory((global.mouka = {}),global.fs,global.util,global.path));
}(this, (function (exports,fs,util,path) { 'use strict';

fs = fs && fs.hasOwnProperty('default') ? fs['default'] : fs;
util = util && util.hasOwnProperty('default') ? util['default'] : util;
path = path && path.hasOwnProperty('default') ? path['default'] : path;

function toString(data) {
	if (data === null)
		return 'null'
	if (data === undefined)
		return 'undefined'
	try {
		return data.toString()
	} catch(e) {
		return '--- unable to call .toString() ---'
	}
}

function toJson(data) {
	try {
		if (data === null)
			return null
		if (data === undefined)
			return undefined
		else
			return stringify(data)
	} catch(e) {
		return '--- unable to JSON.stringify ---'
	}
}

function escapeHtml(data) {
	return data.replace(/&/g, '&amp;')
			   .replace(/</g, '&lt;')
			   .replace(/>/g, '&gt;')
			   .replace(/"/g, '&quot;')
			   .replace(/'/g, '&apos;')
}

function prettyPrintCode(fn) {
	var code = fn.toString().trim().replace(/\t/g, '  ');
	code = escapeHtml(code);
	var lines = code.split('\n');
	if (lines.length === 1)
		return code
	var lastLine = lines[lines.length - 1];
	var indentSpaceCount = lastLine.length - lastLine.trim().length;
	if (indentSpaceCount === 0)
		return code
	var indentation = ' '.repeat(indentSpaceCount);
	return lines
		.map(line => {
			if (line.startsWith(indentation))
				return line.slice(indentSpaceCount)
			else
				return line
		})
		.join('\n')
}

// JSON.stringify with pretty print that keeps array of primitives one-liner

function stringify(data, spaces = 2) {
	return JSON.stringify(data, replacer, spaces)
		.replace(/\"\^\^\^\[/g, '[')
		.replace(/\]\^\^\^\"/g, ']')
}

function replacer(key, val) {
	if (Array.isArray(val) && isPrimitive(val[0])
	&& isPrimitive(val[1]) && isPrimitive(val[2]))
		return '^^^' + JSON.stringify(val) + '^^^'
	return val
}

function isPrimitive(data) {
	return data === null
		|| data === undefined
		|| data.constructor === String
		|| data.constructor === Number
		|| data.constructor === Boolean
}

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


function getTestName() {
	if (isNode)
		return process.argv[2]
	else
		return document.currentScript.src.split('/').pop().split('.').shift()
}

var _log = console.log.bind(console);
var _error = console.error.bind(console);

var wrapLog = args => args.map(toString).join(' ') + '\n';

function log(...args) {
	_log(...args);
	if (exports.logNode) exports.logNode.textContent += wrapLog(args);
}

function error(...args) {
	_error(...args);
	if (exports.logNode) exports.logNode.textContent += wrapLog(args);
	//logNode.textContent += '<span style="color: red">' + wrapLog(args) + '</span>'
}

function redirectConsoleTo(logNode) {
	console.log = log;
	console.error = error;
}

// Copy Error's contents into a new object that can be stringified
function sanitizeError(err) {
	//var {errno, code, syscall, path, message} = err
	//return {errno, code, syscall, path, message}
	var {message, name} = err;
	var newErr = {message, name};
	Object.keys(err).forEach(key => newErr[key] = err[key]);
	return newErr
}

// TODO: rewrite to to not use JSON
function objectsEqual(a, b) {
	try {
		return JSON.stringify(a) === JSON.stringify(b)
	} catch(e) {
		console.log(e);
	}
}

function traversePath(path$$1, root) {
	path$$1.slice(0);
	var scope = root;
	while (path$$1.length && scope !== undefined)
		scope = scope[path$$1.shift()];
	return scope
}

function onFetchResponse(response) {
	if (response.ok)
		return response
	else
		throw new Error(`not found ${response.url}`)
}

function handleError(err) {
	console.error(err);
	if (!exports.warningNode) return
	var p = document.createElement('p');
	p.textContent = err.message || err.toString();
	exports.warningNode.appendChild(p);
}

;
;
;

exports.canRenderResult = false;

function queryNodes() {
	exports.logNode = document.querySelector('#mouka-log');
	exports.warningNode = document.querySelector('#mouka-warning');
	exports.resultNode = document.querySelector('#mouka-result');
	if (exports.resultNode)
		exports.canRenderResult = true;
}

var separatorLength = 50;



class TestSuite {

	constructor(suiteName, options = {}) {
		if (typeof options === 'string')
			options = {type: options};
		Object.assign(this, options);

		this.suiteName = suiteName;
		this.name = suiteName;

		this.functionsTree = {};
		this._currentFnScope = this.functionsTree;

		this.executeScope = this.executeScope.bind(this);
		this.executeTest = this.executeTest.bind(this);
		this.importLog = this.importLog.bind(this);
		this.exportLog = this.exportLog.bind(this);

		// Import log if we're coing Comparative Drive Development
		if (this.type === 'cdd' && !isNode && this.autoImport)
			this.importLog();
	}


	async run() {
		if (this.type === 'cdd' && !isNode)
			await this.importLog();
		try {
			return await this.executeScope(undefined, this.functionsTree)
		} catch(err) {
			throw 'Something went wrong during execution of the test cases.' + ' ' + err.message
		}
	}


	async executeScope(name, scope, path$$1 = []) {
		if (name) {
			log('#'.repeat(separatorLength));
			log('# scope:', name);
			if (exports.canRenderResult) {
				var fragment = document.createDocumentFragment();
				var nameNode = document.createElement(`h${path$$1.length}`);
				nameNode.textContent = name;
				fragment.appendChild(nameNode);
				exports.resultNode.appendChild(fragment);
			}
		}
		var beforeEach = scope[beforeEachSymbol];
		var afterEach = scope[afterEachSymbol];
		var before = scope[beforeSymbol];
		var after = scope[afterSymbol];
		var output = {};
		
		if (before)
			await Promise.resolve(before()).catch(error);
		
		for (var [name, test] of Object.entries(scope)) {
			if (typeof test === 'object')
				output[name] = await this.executeScope(name, test, [...path$$1, name]);
			else
				output[name] = await this.executeTest(name, test, [...path$$1, name], beforeEach, afterEach);
		}
		
		if (after)
			await Promise.resolve(after()).catch(error);
		
		return output
	}



	async executeTest(name, test, path$$1, beforeEach, afterEach) {
		log('-'.repeat(separatorLength));
		log('running:', name);

		// execution part
		try {
			if (beforeEach)
				await Promise.resolve(beforeEach()).catch(error);
			var result = await test();
			if (afterEach)
				await Promise.resolve(afterEach(result)).catch(error);
			log('result: ', result);
		} catch(err) {
			error('result: ', err);
			var result = sanitizeError(err);
		}

		// render part
		if (exports.canRenderResult) {
			// determine if the test passed
			if (this.type === 'cdd') {
				// get desired result for current test from imported log
				var desiredResult = traversePath(path$$1, this.importedTree);
				// compare executed result against desired result from imported log
				var passed = objectsEqual(desiredResult, result);
			} else {
				var passed = result === undefined;
			}
			// render 
			var fragment = document.createElement('div');
			if (passed) {
				fragment.innerHTML = `<div style="color: green">${name}</div>`;
			} else {
				var testCode = prettyPrintCode(test);
				var innerHTML = `
				<div style="color: red">${name}</div>
				<div style="padding-left: 1rem">
					<pre style="color: gray">${testCode}</pre>
					<div>result is:</div>
					<pre style="color: darkred">${escapeHtml(toJson(result))}</pre>`;
				if (this.type === 'cdd') {
					innerHTML += `
					<div>should be:</div>
					<pre style="color: darkred">${escapeHtml(toJson(desiredResult))}</pre>`;
				}
				innerHTML += `</div>`;
				fragment.innerHTML = innerHTML;
			}
			exports.resultNode.appendChild(fragment);
		}

		return result
	}





	// EXPORT / IMPORT

	importLog() {
		log('importLog');
		if (this.importPromise)
			return this.importPromise
		var logFilePath = `./${this.name}.json`;
		const COULD_NOT_LOAD_MSG = 'Pre-existing logs not found. Tests were not previously ran against Node.';
		this.importPromise = fetch(logFilePath)
			.then(onFetchResponse)
			.then(res => res.json())
			.then(importedTree => this.importedTree = importedTree)
			.catch(err => log('DOPICE', err));
			//.catch(err => {throw new Error(`${COULD_NOT_LOAD_MSG} '${logFilePath}'`)})
		return this.importPromise
	}

	async exportLog(json) {
		var logFilePath = path.join(process.cwd(), `./${this.name}.json`);
		var writeFile = util.promisify(fs.writeFile);
		try {
			await writeFile(logFilePath, json);
			log('LOG SAVED', logFilePath);
		} catch(err) {
			error('ERROR, saving log onsuccessful', logFilePath);
			error(err);
		}
	}


}

var autoRunIn = 1000;

var running = false;

var testSuites = [];
;

var run = isNode ? runAsCli : runAsBrowser;

setTimeout(() => {
	if (isNode) {
		runAsCli();
	} else {
		queryNodes();
		if (exports.logNode)
			redirectConsoleTo(exports.logNode);
	}
});

function setup(type = 'cdd', autoRunIn = 1000) {
	var suiteName = getTestName();
	var suite = new TestSuite(suiteName, type);
	testSuites.push(suite);
	exports.currentSuite = suite;
	autoRunIn = autoRunIn;
	if (!isNode && !running && autoRunIn > -1) {
		running = true;
		timeout(autoRunIn)
			.then(runAsBrowser)
			.catch(handleError);
	}
	return suite
}


async function runAsCli() {
	running = true;
	var suite = setup('cdd');
	// TODO - change 2 to 1
	var runRemotely = process.argv.includes('-r')
					|| process.argv.includes('--remote')
					|| !process.argv.includes('-l');
	if (process.argv.includes('--remote')) {
		// remove working directory from cli args
		var rwd = process.argv[process.argv.indexOf('--remote')];
	} else {
		// remove working directory for sideloaded UWP apps
		var rwd = '..\\bin\\Debug\\AppX\\test';
	}
	// origin working directory
	var owd = process.cwd();
	// Wait for all of mouka to load interpret (since require's are sync)
	await timeout();
	// Change cwd if the tests are to be executed in remote location.
	if (runRemotely) {
		try {
			console.log('running remotely at', rwd);
			process.chdir(rwd);
		} catch(err) {
			console.log(`ERROR: Couldn't change cwd to remote location`);
			throw err
		}
	}
	// import test file
	try {
		require(`${owd}\\${suite.name}.mjs`);
	} catch(e) {
		try {
			require(`${owd}\\${suite.name}.js`);
		} catch(err) {
			console.error(err);
			throw new Error(`couldn't find test file, ${owd}\\${suite.name}.mjs doesn't exist, ${owd}\\${suite.name}.js neither`)
		}
	}
	try {
		// Run tests
		var result = await suite.run();
		// Change cwd back to original location if the tests were executed in remote location.
		if (runRemotely)
			process.chdir(owd);
		// Export tests
		return suite.exportLog(toJson(result))
	} catch(err) {
		console.error(err);
	}
}

async function runAsBrowser() {
	running = true;
	for (var suite of testSuites) {
		await suite.run().catch(handleError);
	}
}

var beforeSymbol = Symbol();
var afterSymbol = Symbol();
var beforeEachSymbol = Symbol();
var afterEachSymbol = Symbol();

self.describe = function(name, defineTests) {
	var parentScope = exports.currentSuite._currentFnScope;
	parentScope[name] = exports.currentSuite._currentFnScope = {};
	defineTests();
	exports.currentSuite._currentFnScope = parentScope;
};

self.it = function(name, test) {
	exports.currentSuite._currentFnScope[name] = test;
};

self.before = function(callback) {
	exports.currentSuite._currentFnScope[beforeSymbol] = callback;
};

self.after = function(callback) {
	exports.currentSuite._currentFnScope[afterSymbol] = callback;
};

self.beforeEach = function(callback) {
	exports.currentSuite._currentFnScope[beforeEachSymbol] = callback;
};

self.afterEach = function(callback) {
	exports.currentSuite._currentFnScope[afterEachSymbol] = callback;
};

//import def from './src/index.mjs'
//export default def

exports.timeout = timeout;
exports.self = self;
exports.isNode = isNode;
exports.getTestName = getTestName;
exports.log = log;
exports.error = error;
exports.redirectConsoleTo = redirectConsoleTo;
exports.sanitizeError = sanitizeError;
exports.objectsEqual = objectsEqual;
exports.traversePath = traversePath;
exports.onFetchResponse = onFetchResponse;
exports.handleError = handleError;
exports.queryNodes = queryNodes;
exports.run = run;
exports.setup = setup;
exports.runAsCli = runAsCli;
exports.runAsBrowser = runAsBrowser;

Object.defineProperty(exports, '__esModule', { value: true });

})));
