import {isNode, timeout} from './util.mjs'
import {execute, compare, render} from './core.mjs'


var exportFileName = 'mouka-results.json'
export var setExportName = newName => exportFileName = newName

export var run = isNode ? runAsCli : runAsBroswer

if (isNode)
	runAsCli()

export async function runAsCli() {
	console.log('runAsCli')
	// TODO - change 2 to 1
	var testFileName = process.argv[2]
	var runRemotely = process.argv.includes('-r')
					|| process.argv.includes('--remote')
					|| !process.argv.includes('-l')
	if (process.argv.includes('--remote')) {
		// remove working directory from cli args
		var rwd = process.argv[process.argv.indexOf('--remote')]
	} else {
		// remove working directory for sideloaded UWP apps
		var rwd = '../bin/Debug/AppX/test'
	}
	// origin working directory
	var owd = process.cwd()
	// Wait for all of mouka to load interpret (since require's are sync)
	await timeout()
	// Change cwd if the tests are to be executed in remote location.
	if (runRemotely)
		process.chdir(rwd)
	// import test file
	try {
		require(`${owd}/${testFileName}.mjs`)
	} catch(e) {
		require(`${owd}/${testFileName}.js`)
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
	var fs = require('fs')
	var util = require('util')
	var path = require('path')
	var exportFilePath = path.join(process.cwd(), exportFileName)
	var writeFile = util.promisify(fs.writeFile)
	try {
		await writeFile(exportFilePath, json)
		console.log('LOG SAVED', exportFilePath)
	} catch(err) {
		console.error('ERROR, saving log onsuccessful', exportFilePath)
		console.error(err)
	}
}
