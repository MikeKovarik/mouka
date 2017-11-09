import fs from 'fs'
import util from 'util'
import path from 'path'
import {isNode, handleError, timeout, sanitizeError, objectsEqual, traversePath, onFetchResponse} from './util.mjs'
import {SCOPE_SYMBOL, TEST_SYMBOL} from './util.mjs'
import {toJson, toString, prettyPrintCode, escapeHtml} from './stringify.mjs'
import {beforeSymbol, afterSymbol, beforeEachSymbol, afterEachSymbol} from './api.mjs'
import {resultNode} from './util.mjs'


var separatorLength = 30



export class TestSuite {

	constructor(suiteName, options = {}) {
		if (typeof options === 'string')
			options = {type: options}
		Object.assign(this, options)

		this.suiteName = suiteName
		this.name = suiteName

		this.functionsTree = {}
		this._currentFnScope = this.functionsTree

		this.execute = this.execute.bind(this)
		this.executeScope = this.executeScope.bind(this)
		this.executeTest = this.executeTest.bind(this)
		this.compare = this.compare.bind(this)
		this.compareScope = this.compareScope.bind(this)
		this.compareTest = this.compareTest.bind(this)
		this.render = this.render.bind(this)
		this.renderScope = this.renderScope.bind(this)
		this.renderTest = this.renderTest.bind(this)
		this.importLog = this.importLog.bind(this)
		this.exportLog = this.exportLog.bind(this)

		// Import log if we're coing Comparative Drive Development
		if (!isNode && this.autoImport !== false && this.type === 'cdd')
			this.importLog()
	}


	async run() {
		if (this.type === 'cdd') {
			var fragment = this.render(await this.execute(), await this.importLog())
		} else {
			var fragment = this.render(await this.execute())
		}
		if (resultNode)
			resultNode.appendChild(fragment)
	}


	// EXECUTION

	execute() {
		try {
			this.executePromise = this.executeScope(undefined, this.functionsTree)
			return this.executePromise
		} catch(err) {
			throw 'Something went wrong during execution of the test cases.' + ' ' + err.message
		}
	}

	async executeScope(scopeName, fnScope) {
		if (scopeName) {
			console.log('#'.repeat(separatorLength))
			console.log('# scope:', scopeName)
		}
		var output = {}
		if (fnScope[beforeSymbol])
			fnScope[beforeSymbol]()
		for (var [testName, test] of Object.entries(fnScope)) {
			if (typeof test === 'object')
				output[SCOPE_SYMBOL + testName] = await this.executeScope(testName, test)
			else
				output[TEST_SYMBOL + testName] = await this.executeTest(testName, test, fnScope)
		}
		if (fnScope[afterSymbol])
			fnScope[afterSymbol]()
		return output
	}

	async executeTest(testName, test, fnScope) {
		console.log('-'.repeat(separatorLength))
		console.log('running:', testName)
		try {
			if (fnScope[beforeEachSymbol])
				await Promise.resolve(fnScope[beforeEachSymbol]()).catch(console.error)
			var output = await test()
			if (fnScope[afterEachSymbol])
				await Promise.resolve(fnScope[afterEachSymbol](output)).catch(console.error)
			console.log('output: ', output)
			return output
		} catch(err) {
			//console.error(`Error occured while running '${testName}'`)
			console.error('output: ', err)
			return sanitizeError(err)
		}
	}



	// COMPARATION OF TWO LOGS

	compare(resultLog, importedTree) {
		return this.compareScope(resultLog, importedTree)
	}

	compareScope(resultLog, importedLog) {
		var output = {}
		for (var [name, desiredResult] of Object.entries(importedLog)) {
			if (resultLog[name] === undefined)
				continue
			if (name.startsWith(SCOPE_SYMBOL))
				output[name] = this.compareScope(resultLog[name], desiredResult)
			else if (name.startsWith(TEST_SYMBOL))
				output[name] = this.compareTest(name, resultLog[name], desiredResult)
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

	renderScope(scopeName, resultScope, path = []) {
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
		for (var [name, result] of Object.entries(resultScope)) {
			let symbol = name.slice(0, 2)
			name = name.slice(2)
			if (symbol === SCOPE_SYMBOL)
				var testFragment = this.renderScope(name, result, [...path, name])
			else if (symbol === TEST_SYMBOL)
				var testFragment = this.renderTest(name, result, [...path, name])
			block.appendChild(testFragment)
		}
		return fragment
	}

	renderTest(testName, testResult, path) {
		var fragment = document.createElement('div')
		var testPassed = false
		if (this.type === 'cdd' && testResult === true)
			testPassed = true
		if (this.type === 'bdd' && testResult === undefined)
			testPassed = true
		var color = testPassed ? 'green' : 'red'
		var innerHTML = `<div style="color: ${color}">${testName}</div>`

		if (!testPassed) {
			var test = traversePath(path, this.functionsTree)
			var testCode = prettyPrintCode(test)
		}

		if (this.type === 'cdd' && testResult !== true) {
			var [actualValue, desiredValue] = testResult
			innerHTML += `
			<div style="padding-left: 1rem">
				<pre style="color: gray">${testCode}</pre>
				<div>result is:</div>
				<pre style="color: darkred">${escapeHtml(toJson(actualValue))}</pre>
				<div>should be:</div>
				<pre style="color: darkred">${escapeHtml(toJson(desiredValue))}</pre>
			</div>
			`
		} else if (this.type === 'bdd' && testResult !== undefined) {
			innerHTML += `
			<div style="padding-left: 1rem">
				<pre style="color: gray">${testCode}</pre>
				<div>output is:</div>
				<pre style="color: darkred">${escapeHtml(toJson(testResult))}</pre>
			</div>
			`
		}
		fragment.innerHTML = innerHTML
		return fragment
	}




	// EXPORT / IMPORT

	importLog() {
		if (this.importPromise)
			return this.importPromise
		var logFilePath = `./${this.name}.json`
		const COULD_NOT_LOAD_MSG = 'Pre-existing logs not found. Tests were not previously ran against Node.'
		this.importPromise = fetch(logFilePath)
			.then(onFetchResponse)
			.then(res => res.json())
			.catch(err => {throw new Error(`${COULD_NOT_LOAD_MSG} '${logFilePath}'`)})
		return this.importPromise
	}

	async exportLog(json) {
		var logFilePath = path.join(process.cwd(), `./${this.name}.json`)
		var writeFile = util.promisify(fs.writeFile)
		try {
			await writeFile(logFilePath, json)
			console.log('LOG SAVED', logFilePath)
		} catch(err) {
			console.error('ERROR, saving log onsuccessful', logFilePath)
			console.error(err)
		}
	}


}
