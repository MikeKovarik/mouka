import {toString, toJson} from './stringify.mjs'

export var timeout = (millis = 0) => new Promise(resolve => setTimeout(resolve, millis))

export var self = typeof global === 'object' ? global : window

export var isNode = typeof process === 'object' && process.versions.node

export var cwd
if (isNode) {
	cwd = process.cwd()
} else if (typeof Windows !== 'undefined') {
	let installPath = Windows.ApplicationModel.Package.current.installedLocation.path
	// get rid of bin/debug/appx
	let split = installPath.split('\\').slice(0, -3)
	// assume the tests are in 'test' directory. TODO: add some api for specifying (or hooking into test's currentScript.href)
	split.push('test')
	cwd = split.join('\\')
}

export var SCOPE_SYMBOL = '>|'
export var TEST_SYMBOL = '#|'


export function getTestName() {
	if (isNode)
		return process.argv[2]
	else
		return document.currentScript.src.split('/').pop().split('.').shift()
}

export function redirectConsoleTo(logNode) {

	var _log = console.log.bind(console)
	var _error = console.error.bind(console)

	var wrapLog = args => args.map(toString).join(' ') + '\n'

	console.log = function log(...args) {
		_log(...args)
		logNode.textContent += wrapLog(args)
	}

	console.error = function error(...args) {
		_error(...args)
		logNode.textContent += wrapLog(args)
		//logNode.textContent += '<span style="color: red">' + wrapLog(args) + '</span>'
	}

}

// Copy Error's contents into a new object that can be stringified
export function sanitizeError(err) {
	//var {errno, code, syscall, path, message} = err
	//return {errno, code, syscall, path, message}
	var {message, name} = err
	var newErr = {message, name}
	Object.keys(err).forEach(key => newErr[key] = err[key])
	return newErr
}

// TODO: rewrite to to not use JSON
export function objectsEqual(a, b) {
	try {
		return JSON.stringify(a) === JSON.stringify(b)
	} catch(e) {
		console.log(e)
	}
}

export function traversePath(path, root) {
	path.slice(0)
	var scope = root
	while (path.length && scope !== undefined)
		scope = scope[path.shift()]
	return scope
}

export function onFetchResponse(response) {
	if (response.ok)
		return response
	else
		throw new Error(`not found ${response.url}`)
}

export function handleError(err) {
	console.error(err)
	if (!warningNode) return
	var p = document.createElement('p')
	p.textContent = err.message || err.toString()
	warningNode.appendChild(p)
}

export var logNode
export var warningNode
export var resultNode

export function queryNodes() {
	logNode = document.querySelector('#mouka-log')
	warningNode = document.querySelector('#mouka-warning')
	resultNode = document.querySelector('#mouka-result')
}