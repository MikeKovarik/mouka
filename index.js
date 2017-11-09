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

var SCOPE_SYMBOL = '>|';
var TEST_SYMBOL = '#|';


function getTestName() {
	if (isNode)
		return process.argv[2]
	else
		return document.currentScript.src.split('/').pop().split('.').shift()
}

function redirectConsoleTo(logNode) {

	var _log = console.log.bind(console);
	var _error = console.error.bind(console);

	var wrapLog = args => args.map(toString).join(' ') + '\n';

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

function queryNodes() {
	exports.logNode = document.querySelector('#mouka-log');
	exports.warningNode = document.querySelector('#mouka-warning');
	exports.resultNode = document.querySelector('#mouka-result');
}

var separatorLength = 30;



class TestSuite {

	constructor(suiteName, options = {}) {
		if (typeof options === 'string')
			options = {type: options};
		Object.assign(this, options);

		this.suiteName = suiteName;
		this.name = suiteName;

		this.functionsTree = {};
		this._currentFnScope = this.functionsTree;

		this.execute = this.execute.bind(this);
		this.executeScope = this.executeScope.bind(this);
		this.executeTest = this.executeTest.bind(this);
		this.compare = this.compare.bind(this);
		this.compareScope = this.compareScope.bind(this);
		this.compareTest = this.compareTest.bind(this);
		this.render = this.render.bind(this);
		this.renderScope = this.renderScope.bind(this);
		this.renderTest = this.renderTest.bind(this);
		this.importLog = this.importLog.bind(this);
		this.exportLog = this.exportLog.bind(this);

		// Import log if we're coing Comparative Drive Development
		if (!isNode && this.autoImport !== false && this.type === 'cdd')
			this.importLog();
	}


	async run() {
		if (this.type === 'cdd') {
			var fragment = this.render(await this.execute(), await this.importLog());
		} else {
			var fragment = this.render(await this.execute());
		}
		if (exports.resultNode)
			exports.resultNode.appendChild(fragment);
	}


	// EXECUTION

	execute() {
		try {
			this.executePromise = this.executeScope(undefined, this.functionsTree);
			return this.executePromise
		} catch(err) {
			throw 'Something went wrong during execution of the test cases.' + ' ' + err.message
		}
	}

	async executeScope(scopeName, fnScope) {
		if (scopeName) {
			console.log('#'.repeat(separatorLength));
			console.log('# scope:', scopeName);
		}
		var output = {};
		if (fnScope[beforeSymbol])
			fnScope[beforeSymbol]();
		for (var [testName, test] of Object.entries(fnScope)) {
			if (typeof test === 'object')
				output[SCOPE_SYMBOL + testName] = await this.executeScope(testName, test);
			else
				output[TEST_SYMBOL + testName] = await this.executeTest(testName, test, fnScope);
		}
		if (fnScope[afterSymbol])
			fnScope[afterSymbol]();
		return output
	}

	async executeTest(testName, test, fnScope) {
		console.log('-'.repeat(separatorLength));
		console.log('running:', testName);
		try {
			if (fnScope[beforeEachSymbol])
				await Promise.resolve(fnScope[beforeEachSymbol]()).catch(console.error);
			var output = await test();
			if (fnScope[afterEachSymbol])
				await Promise.resolve(fnScope[afterEachSymbol](output)).catch(console.error);
			console.log('output: ', output);
			return output
		} catch(err) {
			//console.error(`Error occured while running '${testName}'`)
			console.error('output: ', err);
			return sanitizeError(err)
		}
	}



	// COMPARATION OF TWO LOGS

	compare(resultLog, importedTree) {
		return this.compareScope(resultLog, importedTree)
	}

	compareScope(resultLog, importedLog) {
		var output = {};
		for (var [name, desiredResult] of Object.entries(importedLog)) {
			if (resultLog[name] === undefined)
				continue
			if (name.startsWith(SCOPE_SYMBOL))
				output[name] = this.compareScope(resultLog[name], desiredResult);
			else if (name.startsWith(TEST_SYMBOL))
				output[name] = this.compareTest(name, resultLog[name], desiredResult);
		}
		return output
	}

	compareTest(testName, actualResult, desiredResult) {
		if (objectsEqual(desiredResult, actualResult))
			return true
		else
			return [actualResult, desiredResult]
	}



	// RENDERING RESULT OF LOGS

	render(resultTree, importedTree) {
		if (importedTree)
			return this.renderScope(undefined, this.compare(resultTree, importedTree))
		else
			return this.renderScope(undefined, resultTree)
	}

	renderScope(scopeName, resultScope, path$$1 = []) {
		var fragment = document.createDocumentFragment();
		if (scopeName) {
			var nameNode = document.createElement(`h${path$$1.length}`);
			nameNode.textContent = scopeName;
			fragment.appendChild(nameNode);
			var block = document.createElement('div');
			block.style.paddingLeft = '1rem';
			fragment.appendChild(block);
		} else {
			var block = fragment;
		}
		for (var [name, result] of Object.entries(resultScope)) {
			let symbol = name.slice(0, 2);
			name = name.slice(2);
			if (symbol === SCOPE_SYMBOL)
				var testFragment = this.renderScope(name, result, [...path$$1, name]);
			else if (symbol === TEST_SYMBOL)
				var testFragment = this.renderTest(name, result, [...path$$1, name]);
			block.appendChild(testFragment);
		}
		return fragment
	}

	renderTest(testName, testResult, path$$1) {
		var fragment = document.createElement('div');
		var testPassed = false;
		if (this.type === 'cdd' && testResult === true)
			testPassed = true;
		if (this.type === 'bdd' && testResult === undefined)
			testPassed = true;
		var color = testPassed ? 'green' : 'red';
		var innerHTML = `<div style="color: ${color}">${testName}</div>`;

		if (!testPassed) {
			var test = traversePath(path$$1, this.functionsTree);
			var testCode = prettyPrintCode(test);
		}

		if (this.type === 'cdd' && testResult !== true) {
			var [actualValue, desiredValue] = testResult;
			innerHTML += `
			<div style="padding-left: 1rem">
				<pre style="color: gray">${testCode}</pre>
				<div>result is:</div>
				<pre style="color: darkred">${escapeHtml(toJson(actualValue))}</pre>
				<div>should be:</div>
				<pre style="color: darkred">${escapeHtml(toJson(desiredValue))}</pre>
			</div>
			`;
		} else if (this.type === 'bdd' && testResult !== undefined) {
			innerHTML += `
			<div style="padding-left: 1rem">
				<pre style="color: gray">${testCode}</pre>
				<div>output is:</div>
				<pre style="color: darkred">${escapeHtml(toJson(testResult))}</pre>
			</div>
			`;
		}
		fragment.innerHTML = innerHTML;
		return fragment
	}




	// EXPORT / IMPORT

	importLog() {
		if (this.importPromise)
			return this.importPromise
		var logFilePath = `./${this.name}.json`;
		const COULD_NOT_LOAD_MSG = 'Pre-existing logs not found. Tests were not previously ran against Node.';
		this.importPromise = fetch(logFilePath)
			.then(onFetchResponse)
			.then(res => res.json())
			.catch(err => {throw new Error(`${COULD_NOT_LOAD_MSG} '${logFilePath}'`)});
		return this.importPromise
	}

	async exportLog(json) {
		var logFilePath = path.join(process.cwd(), `./${this.name}.json`);
		var writeFile = util.promisify(fs.writeFile);
		try {
			await writeFile(logFilePath, json);
			console.log('LOG SAVED', logFilePath);
		} catch(err) {
			console.error('ERROR, saving log onsuccessful', logFilePath);
			console.error(err);
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
		var result = await suite.execute();
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
exports.SCOPE_SYMBOL = SCOPE_SYMBOL;
exports.TEST_SYMBOL = TEST_SYMBOL;
exports.getTestName = getTestName;
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
