import {isNode, handleError, timeout, redirectConsoleTo, getTestName} from './util.mjs'
import {toJson} from './stringify.mjs'
import {queryNodes, logNode} from './util.mjs'
import {TestSuite} from './TestSuite.mjs'



var autoRunIn = 1000

var running = false

var testSuites = []
export var currentSuite

export var run = isNode ? runAsCli : runAsBrowser

setTimeout(() => {
	if (isNode) {
		runAsCli()
	} else {
		queryNodes()
		if (logNode)
			redirectConsoleTo(logNode)
	}
})

export function setup(type = 'cdd', autoRunIn = 1000) {
	var suiteName = getTestName()
	var suite = new TestSuite(suiteName, type)
	testSuites.push(suite)
	currentSuite = suite
	autoRunIn = autoRunIn
	if (!isNode && !running && autoRunIn > -1) {
		running = true
		timeout(autoRunIn)
			.then(runAsBrowser)
			.catch(handleError)
	}
	return suite
}


export async function runAsCli() {
	running = true
	var suite = setup('cdd')
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
			process.chdir(rwd)
		} catch(err) {
			console.log(`ERROR: Couldn't change cwd to remote location`)
			throw err
		}
	}
	// import test file
	try {
		require(`${owd}\\${suite.name}.mjs`)
	} catch(e) {
		try {
			require(`${owd}\\${suite.name}.js`)
		} catch(err) {
			console.error(err)
			throw new Error(`couldn't find test file, ${owd}\\${suite.name}.mjs doesn't exist, ${owd}\\${suite.name}.js neither`)
		}
	}
	try {
		// Run tests
		var result = await suite.execute()
		// Change cwd back to original location if the tests were executed in remote location.
		if (runRemotely)
			process.chdir(owd)
		// Export tests
		return suite.exportLog(toJson(result))
	} catch(err) {
		console.error(err)
	}
}

export async function runAsBrowser() {
	running = true
	for (var suite of testSuites) {
		await suite.run().catch(handleError)
	}
}

