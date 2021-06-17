import type { Nesting } from 'markdown-it/lib/token';
import type { StateCore, Token } from './types';

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
	callback: (currToken: Token, index: number, currTokenArr: Token[]) => void
) {
	const recurse = (tokenArr: Token[]) => {
		for (let x = 0; x < tokenArr.length; x++) {
			const token = tokenArr[x];
			callback(token, x, tokenArr);
			if (token.children) {
				recurse(token.children);
			}
		}
	};
	recurse(Array.isArray(input) ? input : input.tokens);
}

/**
 * Given a string containing zero or more <^> delimited vars, wrap each instance in a highligh span, replacing the delimiters as well
 * @param text Input text to process
 */
export function SpanWrapVars(text: string) {
	const patt = /<\^>(.+?)<\^>/gm;
	text = text.replace(patt, (match, p1) => {
		return `<span class="highlight">${p1}</span>`;
	});
	return text;
}

/**
 * This is basically DO-flavored HTML escaping
 *  - Be careful not to call escapeHtml on the text returned by this, or else you will end up with double escaped entities (since this returns `&` as part of HTML encoding)
 */
export function docoFlavoredReplacer(input: string) {
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
		{
			find: /"([^"]*?)"/g,
			replace: (substring) => {
				substring = substring.replace(/"/g, '');
				return `&ldquo;${substring}&rdquo;`;
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
		// but NOT if it is the only thing on the line
		{
			find: /[^\r\n ]''/g,
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
		// Edge-case: single quote at end of line
		// {
		// 	find: /'$/g,
		// 	replace: '&rsquo;',
		// },
		// Edge-case: If single quote is directly touching parenthesis
		{
			find: /\('/g,
			replace: '(&lsquo;',
		},
		{
			find: /'\)/g,
			replace: '&rsquo;)',
		},
		// Edge-case: single quote, unpaired, that touches *certain* chars on left are turned into rsquo
		{
			find: /[&$]'|&amp;'/g,
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
