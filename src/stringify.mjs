export function toString(data) {
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

export function toJson(data) {
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

export function escapeHtml(data) {
	return data.replace(/&/g, '&amp;')
			   .replace(/</g, '&lt;')
			   .replace(/>/g, '&gt;')
			   .replace(/"/g, '&quot;')
			   .replace(/'/g, '&apos;')
}

export function prettyPrintCode(fn) {
	var code = fn.toString().trim().replace(/\t/g, '  ')
	code = escapeHtml(code)
	var lines = code.split('\n')
	if (lines.length === 1)
		return code
	var lastLine = lines[lines.length - 1]
	var indentSpaceCount = lastLine.length - lastLine.trim().length
	if (indentSpaceCount === 0)
		return code
	var indentation = ' '.repeat(indentSpaceCount)
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

export function stringify(data, spaces = 2) {
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