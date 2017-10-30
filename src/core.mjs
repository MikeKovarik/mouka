import {timeout, sanitizeError, stringify, objectsEqual, traversePath, escapeHtml} from './util.mjs'
import {SCOPE_SYMBOL, TEST_SYMBOL} from './util.mjs'
import {testsRoot} from './api.mjs'



var separatorLength = 30

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
		console.log('#'.repeat(separatorLength))
		console.log('# scope:', scopeName)
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
	console.log('-'.repeat(separatorLength))
	console.log('running:', testName)
	try {
		var output = await test()
		console.log('output: ', output)
		return output
	} catch(err) {
		//console.error(`Error occured while running '${testName}'`)
		console.error('output: ', err)
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
		var nameNode = document.createElement(`h${path.length}`)
		nameNode.textContent = scopeName
		fragment.appendChild(nameNode)
		var block = document.createElement('div')
		block.style.paddingLeft = '1rem'
		fragment.appendChild(block)
	} else {
		var block = fragment
	}
	for (var [name, result] of Object.entries(scope)) {
		let symbol = name.slice(0, 2)
		name = name.slice(2)
		if (symbol === SCOPE_SYMBOL)
			var testFragment = renderScope(name, result, [...path, name])
		else if (symbol === TEST_SYMBOL)
			var testFragment = renderTest(name, result, [...path, name])
		block.appendChild(testFragment)
	}
	return fragment
}

function renderTest(testName, testResult, path) {
	var fragment = document.createElement('div')
	var color = testResult === true ? 'green' : 'red'
	var innerHTML = `<div style="color: ${color}">${testName}</div>`
	if (testResult !== true) {
		var [actualValue, desiredValue] = testResult
		var test = traversePath(path, testsRoot)
		var testCode = escapeHtml(test.toString())
		innerHTML += `
		<div style="padding-left: 1rem">
			<pre style="color: gray">${testCode}</pre>
			<div>result is:</div>
			<pre style="color: darkred">${stringify(actualValue)}</pre>
			<div>should be:</div>
			<pre style="color: darkred">${stringify(desiredValue)}</pre>
		</div>
		`
	}
	fragment.innerHTML = innerHTML
	return fragment
}
