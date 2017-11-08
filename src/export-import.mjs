import fs from 'fs'
import util from 'util'
import path from 'path'
import {isNode, timeout, redirectConsoleTo} from './util.mjs'
import {execute, compare, render} from './core.mjs'


var testName
var autoRunIn = 900
export function setup(autoRunIn = 900) {
	testName = getTestName()
	autoRunIn = autoRunIn
}

function getTestName() {
	if (isNode)
		return process.argv[2]
	else
		return document.currentScript.src.split('/').pop().split('.').shift()
}

export var run = isNode ? runAsCli : runAsBroswer

;(async () => {
	if (isNode) {
		setup()
		runAsCli()
	} else {
		var logNode = document.querySelector('#mouka-log')
		var warningNode = document.querySelector('#mouka-warning')
		var resultNode = document.querySelector('#mouka-result')
		if (logNode)
			redirectConsoleTo(logNode)
		if (autoRunIn !== -1)
			await timeout(autoRunIn)
		try {
			var result = runAsBroswer(resultNode)
		} catch(err) {
			console.error(err)
			if (warningNode)
				warningNode.textContent = err.message || err
		}
	}
})()

export async function runAsCli() {
	// TODO - change 2 to 1
	var runRemotely = process.argv.includes('-r')
					|| process.argv.includes('--remote')
					|| !process.argv.includes('-l')
	if (process.argv.includes('--remote')) {
		// remove working directory from cli args
		var rwd = process.argv[process.argv.indexOf('--remote')]
	} else {
		// remove working directory for sideloaded UWP apps
		var rwd = '..\\bin\\Debug\\AppX\\test'
	}
	// origin working directory
	var owd = process.cwd()
	// Wait for all of mouka to load interpret (since require's are sync)
	await timeout()
	// Change cwd if the tests are to be executed in remote location.
	if (runRemotely) {
		try {
			console.log('running remotely at', rwd)
			var path = require('path')
			process.chdir(rwd)
		} catch(err) {
			console.log(`ERROR: Couldn't change cwd to remote location`)
			throw err
		}
	}
	// import test file
	try {
		require(`${owd}\\${testName}.mjs`)
	} catch(e) {
		try {
			require(`${owd}\\${testName}.js`)
		} catch(err) {
			console.error(err)
			throw new Error(`couldn't find test file, ${owd}\\${testName}.mjs doesn't exist, ${owd}\\${testName}.js neither`)
		}
	}
	try {
		// Run tests
		var log = await execute()
		// Change cwd back to original location if the tests were executed in remote location.
		if (runRemotely)
			process.chdir(owd)
		// Export tests
		return stringifyLog(log)
			.then(exportLog)
	} catch(err) {
		console.error(err)
	}
}

export async function runAsBroswer(outputElement) {
	var promises = [importLog(), execute()]
	var [nodeLog, browserLog] = await Promise.all(promises)
	var result = compare(nodeLog, browserLog)
	var fragment = render(result)
	if (outputElement)
		outputElement.appendChild(fragment)
	return fragment
}



const COULD_NOT_LOAD_MSG = 'Pre-existing logs not found. Tests were not previously ran against Node.'

async function importLog(fileName = testName) {
	var logFilePath = `./${fileName}.json`
	return fetch(logFilePath)
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

// TODO: support for undefined values
async function stringifyLog(log) {
	return JSON.stringify(log, null, 4)
}

async function exportLog(json, fileName = testName) {
	var logFilePath = path.join(process.cwd(), `./${fileName}.json`)
	var writeFile = util.promisify(fs.writeFile)
	try {
		await writeFile(logFilePath, json)
		console.log('LOG SAVED', logFilePath)
	} catch(err) {
		console.error('ERROR, saving log onsuccessful', logFilePath)
		console.error(err)
	}
}
