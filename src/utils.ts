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
