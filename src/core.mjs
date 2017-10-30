import {self, timeout, sanitizeError, stringify, objectsEqual, traversePath, SCOPE_SYMBOL, TEST_SYMBOL} from './util.mjs'
import {testsRoot} from './api.mjs'



// EXECUTION

export async function execute() {
	try {
		return executeScope(undefined, testsRoot)
	} catch(err) {
		throw 'Something went wrong during execution of the test cases.' + ' ' + err.message
	}
}

async function executeScope(scopeName, tests) {
	if (scopeName) {
		console.log('#########################')
		console.log('running scope:', scopeName)
	}
	var output = {}
	for (var [testName, test] of Object.entries(tests)) {
		if (typeof test === 'object')
			output[SCOPE_SYMBOL + testName] = await executeScope(testName, test)
		else
			output[TEST_SYMBOL + testName] = await executeTest(testName, test)
	}
	return output
}

async function executeTest(testName, test) {
	console.log('-------------------------')
	console.log('running test:', testName)
	try {
		var result = await test()
		console.log(result)
		return result
	} catch(err) {
		//console.error(`Error occured while running '${testName}'`)
		console.error(err)
		return sanitizeError(err)
	}
}



// COMPARATION OF TWO LOGS

export var compare = compareScope

function compareScope(mainLog, secondaryLog) {
	var output = {}
	for (var [name, desiredResult] of Object.entries(mainLog)) {
		if (secondaryLog[name] === undefined)
			continue
		if (name.startsWith(SCOPE_SYMBOL))
			output[name] = compareScope(desiredResult, secondaryLog[name])
		else if (name.startsWith(TEST_SYMBOL))
			output[name] = compareTest(name, desiredResult, secondaryLog[name])
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

export var render = renderScope.bind(undefined, undefined)

function renderScope(scopeName, scope, path = []) {
	var fragment = document.createDocumentFragment()
	if (scopeName) {
		var nameNode = document.createElement('h4')
		nameNode.textContent = scopeName
		fragment.appendChild(nameNode)
	}
	for (var [name, result] of Object.entries(scope)) {
		let symbol = name.slice(0, 2)
		name = name.slice(2)
		if (symbol === SCOPE_SYMBOL)
			var testFragment = renderScope(name, result, [...path, name])
		else if (symbol === TEST_SYMBOL)
			var testFragment = renderTest(name, result, [...path, name])
		fragment.appendChild(testFragment)
	}
	return fragment
}

function renderTest(testName, testResult, path) {
	var fragment = document.createDocumentFragment()
	var nameNode = document.createElement('div')
	nameNode.textContent = testName
	nameNode.style.color = testResult === true ? 'green' : 'red'
	fragment.appendChild(nameNode)
	if (testResult === true)
		return fragment
	var [actualValue, desiredValue] = testResult
	var codePre = document.createElement('pre')
	var test = traversePath(path, testsRoot)
	codePre.textContent = test.toString()
	var div1 = document.createElement('div')
	var div2 = document.createElement('div')
	div1.textContent = 'result is:'
	div2.textContent = 'should be:'
	var pre1 = document.createElement('pre')
	var pre2 = document.createElement('pre')
	pre1.textContent = stringify(actualValue)
	pre2.textContent = stringify(desiredValue)
	fragment.appendChild(codePre)
	fragment.appendChild(div1)
	fragment.appendChild(pre1)
	fragment.appendChild(div2)
	fragment.appendChild(pre2)
	return fragment
}
