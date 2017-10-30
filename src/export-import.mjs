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
	// import test file
	await timeout()
	try {
		require(`${process.cwd()}/${testFileName}.mjs`)
	} catch(e) {
		require(`${process.cwd()}/${testFileName}.js`)
	}
	execute()
		.then(stringifyLog)
		.then(exportLog)
		.catch(err => console.error(err))
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
	console.log('exportFilePath', exportFilePath)
	return writeFile(exportFilePath, json)
}
