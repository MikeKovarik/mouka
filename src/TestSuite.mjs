import fs from 'fs'
import util from 'util'
import path from 'path'
import {isNode, handleError, timeout, sanitizeError, objectsEqual, traversePath, onFetchResponse} from './util.mjs'
import {log, error, canRenderResult, resultNode} from './util.mjs'
import {toJson, toString, prettyPrintCode, escapeHtml} from './stringify.mjs'
import {beforeSymbol, afterSymbol, beforeEachSymbol, afterEachSymbol} from './api.mjs'


var separatorLength = 50



export class TestSuite {

	constructor(suiteName, options = {}) {
		if (typeof options === 'string')
			options = {type: options}
		Object.assign(this, options)

		this.suiteName = suiteName
		this.name = suiteName

		this.functionsTree = {}
		this._currentFnScope = this.functionsTree

		this.executeScope = this.executeScope.bind(this)
		this.executeTest = this.executeTest.bind(this)
		this.importLog = this.importLog.bind(this)
		this.exportLog = this.exportLog.bind(this)

		// Import log if we're coing Comparative Drive Development
		if (this.type === 'cdd' && !isNode && this.autoImport)
			this.importLog()
	}


	async run() {
		if (this.type === 'cdd' && !isNode)
			await this.importLog()
		try {
			return await this.executeScope(undefined, this.functionsTree)
		} catch(err) {
			throw 'Something went wrong during execution of the test cases.' + ' ' + err.message
		}
	}


	async executeScope(name, scope, path = []) {
		if (name) {
			log('#'.repeat(separatorLength))
			log('# scope:', name)
			if (canRenderResult) {
				var fragment = document.createDocumentFragment()
				var nameNode = document.createElement(`h${path.length}`)
				nameNode.textContent = name
				fragment.appendChild(nameNode)
				resultNode.appendChild(fragment)
			}
		}
		var beforeEach = scope[beforeEachSymbol]
		var afterEach = scope[afterEachSymbol]
		var before = scope[beforeSymbol]
		var after = scope[afterSymbol]
		var output = {}
		
		if (before)
			await Promise.resolve(before()).catch(error)
		
		for (var [name, test] of Object.entries(scope)) {
			if (typeof test === 'object')
				output[name] = await this.executeScope(name, test, [...path, name])
			else
				output[name] = await this.executeTest(name, test, [...path, name], beforeEach, afterEach)
		}
		
		if (after)
			await Promise.resolve(after()).catch(error)
		
		return output
	}



	async executeTest(name, test, path, beforeEach, afterEach) {
		log('-'.repeat(separatorLength))
		log('running:', name)

		// execution part
		try {
			if (beforeEach)
				await Promise.resolve(beforeEach()).catch(error)
			var result = await test()
			if (afterEach)
				await Promise.resolve(afterEach(result)).catch(error)
			log('result: ', result)
		} catch(err) {
			error('result: ', err)
			var result = sanitizeError(err)
		}

		// render part
		if (canRenderResult) {
			// determine if the test passed
			if (this.type === 'cdd') {
				// get desired result for current test from imported log
				var desiredResult = traversePath(path, this.importedTree)
				// compare executed result against desired result from imported log
				var passed = objectsEqual(desiredResult, result)
			} else {
				var passed = result === undefined
			}
			// render 
			var fragment = document.createElement('div')
			if (passed) {
				fragment.innerHTML = `<div style="color: green">${name}</div>`
			} else {
				var testCode = prettyPrintCode(test)
				var innerHTML = `
				<div style="color: red">${name}</div>
				<div style="padding-left: 1rem">
					<pre style="color: gray">${testCode}</pre>
					<div>result is:</div>
					<pre style="color: darkred">${escapeHtml(toJson(result))}</pre>`
				if (this.type === 'cdd') {
					innerHTML += `
					<div>should be:</div>
					<pre style="color: darkred">${escapeHtml(toJson(desiredResult))}</pre>`
				}
				innerHTML += `</div>`
				fragment.innerHTML = innerHTML
			}
			resultNode.appendChild(fragment)
		}

		return result
	}





	// EXPORT / IMPORT

	importLog() {
		log('importLog')
		if (this.importPromise)
			return this.importPromise
		var logFilePath = `./${this.name}.json`
		const COULD_NOT_LOAD_MSG = 'Pre-existing logs not found. Tests were not previously ran against Node.'
		this.importPromise = fetch(logFilePath)
			.then(onFetchResponse)
			.then(res => res.json())
			.then(importedTree => this.importedTree = importedTree)
			.catch(err => log('DOPICE', err))
			//.catch(err => {throw new Error(`${COULD_NOT_LOAD_MSG} '${logFilePath}'`)})
		return this.importPromise
	}

	async exportLog(json) {
		var logFilePath = path.join(process.cwd(), `./${this.name}.json`)
		var writeFile = util.promisify(fs.writeFile)
		try {
			await writeFile(logFilePath, json)
			log('LOG SAVED', logFilePath)
		} catch(err) {
			error('ERROR, saving log onsuccessful', logFilePath)
			error(err)
		}
	}


}
