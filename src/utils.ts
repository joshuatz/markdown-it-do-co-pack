import type { Nesting } from 'markdown-it/lib/token';
import type { MarkdownIt, StateCore, Token } from './types';

export function getHtmlBlock(state: StateCore, nesting: Nesting, content?: string) {
	const token = new state.Token('html_block', '', nesting);
	token.content = content || '';
	return token;
}

export function getNewLineToken(state: StateCore, nesting: Nesting = 0) {
	const token = new state.Token('text', '', nesting);
	token.content = '\n';
	return token;
}

/**
 * Simple, and likely non-optimal recurser / flattener of tokens
 * - Inside callback, use index and array to replace current token if need be
 */
export function tokenRecurser(
	input: StateCore | Token[],
	callback: (currToken: Token, index: number, currTokenArr: Token[]) => void,
	backwards = false
) {
	const recurse = (tokenArr: Token[]) => {
		const process = (token: Token, index: number) => {
			callback(token, index, tokenArr);
			if (token.children) {
				recurse(token.children);
			}
		};

		if (backwards) {
			for (let x = tokenArr.length - 1; x >= 0; x--) {
				process(tokenArr[x], x);
			}
		} else {
			for (let x = 0; x < tokenArr.length; x++) {
				process(tokenArr[x], x);
			}
		}
	};
	recurse(Array.isArray(input) ? input : input.tokens);
}

/**
 * Given a string containing zero or more <^> delimited vars, wrap each instance in a highligh span, replacing the delimiters as well
 * - Allows for processing text outside of var differently from text inside var
 */
export function processTextForVars(input: {
	text: string;
	nonVarTextProcessor?: (input: string) => string;
	varTextProcessor?: (input: string) => string;
}): string {
	const patt = /(.*)<\^>(.+?)<\^>(.*)/m;
	let output = '';
	const { text } = input;
	const nonVarTextProcessor = input.nonVarTextProcessor || ((i) => i);
	const varTextProcessor = input.varTextProcessor || ((i) => i);

	if (patt.test(text)) {
		// This has to be done carefully, due to order of escaping
		const matchInfoArr: Array<{
			start: number;
			end: number;
			match: string;
			varStr: string;
		}> = [];

		text.replace(/<\^>(.+?)<\^>/gm, (match, varStr, offset) => {
			matchInfoArr.push({
				start: offset,
				end: offset + match.length,
				match,
				varStr,
			});
			return match;
		});

		// process match info
		let pointer = 0;
		matchInfoArr.forEach((m) => {
			// Grab text before variable section
			const preText = text.slice(pointer, m.start);
			// Compose var section
			const varText = `<span class="highlight">${varTextProcessor(m.varStr)}</span>`;
			// add to output, shift pointer
			output += nonVarTextProcessor(preText) + varText;
			pointer = m.end;
		});

		// Make sure to add any text after the last variable block
		output += nonVarTextProcessor(text.slice(pointer));
	} else {
		output = nonVarTextProcessor(text);
	}

	return output;
}

/**
 * This is a basically a minimal subset of escapeHtml, since code blocks need less escaping
 *  - For example, quotes are allowed through
 * @param input The actual inner code within the fenced code block
 */
export function codeBlockEscape(input: string) {
	let output = input;
	const specialCharReplacements: Array<{
		find: string | RegExp;
		replace: string | ((substring: string, ...args: any[]) => string);
	}> = [
		// RUN THESE FIRST
		{
			find: /&/g,
			replace: '&amp;',
		},
		{
			find: /</g,
			replace: '&lt;',
		},
		{
			find: />/g,
			replace: '&gt;',
		},
	];

	specialCharReplacements.forEach((c) => {
		// @ts-ignore
		output = output.replace(c.find, c.replace);
	});

	return output;
}

/**
 * This is basically DO-flavored HTML escaping
 *  - Be careful not to call escapeHtml on the text returned by this, or else you will end up with double escaped entities (since this returns `&` as part of HTML encoding)
 */
export function docoEscape(input: string) {
	let output = input;
	const specialCharReplacements: Array<{
		find: string | RegExp;
		replace: string | ((substring: string, ...args: any[]) => string);
	}> = [
		// RUN THESE FIRST
		{
			find: /&/g,
			replace: '&amp;',
		},
		{
			find: /</g,
			replace: '&lt;',
		},
		{
			find: />/g,
			replace: '&gt;',
		},
		// ... then everything else
		// Special quote replacement
		// DO tries to find pairs first, replacing with fancy quotes, then falls back to regular doubles
		// It is considered a pair if surrounded by whitespace,
		// OR if there is an equal character `=` touching on either side
		{
			find: /( )"([^"]*?)"( )|^"([^"]*?)"$/g,
			replace: (substring, lSpace, g2, rSpace) => {
				substring = substring.replace(/"/g, '').trim();
				return `${lSpace || ''}&ldquo;${substring}&rdquo;${rSpace || ''}`;
			},
		},
		// See above - this is the other case where considered a pair
		// `=` touching on either side of quotes
		{
			find: /(=)"([^"]*?)"|"([^"]*?)"(=)/g,
			replace: (substring, g1, g2, g3, g4) => {
				if (g1 === '=') {
					return `=&ldquo;${g2}&rdquo;`;
				}

				return `&ldquo;${g4}&rdquo;=`;
			},
		},
		{
			find: /“|[\r\n ]"[^\r\n ]|"$|"'$/g,
			replace: (substring) => {
				return substring.replace(/[“"]/g, '&ldquo;');
			},
		},
		{
			find: /”|[^\r\n ]"[\r\n ]/g,
			replace: (substring) => {
				return substring.replace(/[”"]/g, '&rdquo;');
			},
		},
		// ... and, if a pair of singles shows up on the left, it is replaced by right single and then left single...
		{
			find: /[\r\n ]''[^\r\n ]/g,
			replace: (substring) => {
				return substring.replace(/''/g, '&rsquo;&lsquo;');
			},
		},
		// This doesn't really make sense, but they are using ldquo for double single quotes
		// on the *RIGHT* side (something touching on left)...
		// whether or not there is text touching on the right,
		// but NOT if it is the last thing (or only thing) on the line...
		// ^ ... unless, it is directly prefixed by `)`
		{
			find: /[^\r\n ]''(?!$)|\)''$/g,
			replace: (substring) => {
				return substring.replace(/''/g, '&ldquo;');
			},
		},
		// ... and if a pair of singles is last, then rdquo instead of left single or left double
		{
			find: /''$/g,
			replace: '&rdquo;',
		},
		// If a single is on right edge, or alone at end, rsquo
		{
			find: /[^']+' |[^']+'$|^'$/g,
			replace: (substring) => {
				return substring.replace(/'/g, '&rsquo;');
			},
		},
		// Edge-case: If single quote is directly touching parenthesis
		{
			find: /\('/g,
			replace: '(&lsquo;',
		},
		{
			find: /'\)/g,
			replace: '&rsquo;)',
		},
		/**
		 * Edge-case(s): single quote, unpaired, that touches *certain* chars on certain sides are turned into rsquo
		 * - $'
		 * - &'
		 * - &amp;'
		 * - 'll (as in `you'll` becomes `you&rsquo;ll`)
		 * - 's (as in `here's` becomes `here&rsquo;s`)
		 */
		{
			find: /[&$]'|&amp;'|'ll|'s/g,
			replace: (substring) => {
				return substring.replace(/'/g, '&rsquo;');
			},
		},
		// Here is the double quote fallback, if nothing prior matched
		{
			find: /"/g,
			replace: '&quot;',
		},
		// Symbol shorthand (e.g. registered, trademark, etc.)
		{
			find: /\(R\)/gi,
			replace: '&reg;',
		},
		{
			find: /\(C\)/gi,
			replace: '&copy;',
		},
		{
			find: /\(TM\)/gi,
			replace: '&trade;',
		},
	];

	specialCharReplacements.forEach((c) => {
		// @ts-ignore
		output = output.replace(c.find, c.replace);
	});

	return output;
}

export function getAllRules(mditInstance: MarkdownIt) {
	let allRules: Array<{
		name: string;
		enabled: boolean;
		fn: Function;
		alt: string[];
	}> = [];
	const ruleGroups = ['core', 'block', 'inline'] as const;
	ruleGroups.forEach((chain) => {
		// You are not supposed to use internals this way, but I see no other way to access rules in a way that gives you back the original names
		// The `.getRules('')` public method actually returns JS fns, and most of the other methods don't return correct rule names either
		// @ts-ignore
		allRules = allRules.concat(mditInstance[chain].ruler.__rules__ || []);
	});
	return allRules;
}

export function getIsRuleEnabled(mditInstance: MarkdownIt, ruleName: string, jsFnName?: string) {
	const allRules = getAllRules(mditInstance);
	for (const rule of allRules) {
		if (
			rule.name === ruleName ||
			rule.alt.includes(ruleName) ||
			(jsFnName && rule.fn.name === jsFnName)
		) {
			return rule.enabled;
		}
	}

	return false;
}
