import { Rule } from './types';
import { getHtmlBlock, SpanWrapVars, tokenRecurser } from './utils';

/**
 * This rule handles inline notes
 * @example
 * ```md
 * <$>[warning]
 * **Warning:** Use this to warn users.
 * <$>
 * ```
 * @param state This
 */
export const NotesRule: Rule = (state) => {
	const patt = /<\$>\[(.+)\].+<\$>$/ms;
	const { tokens } = state;

	for (let x = 0; x < tokens.length; x++) {
		const currTopToken = tokens[x];
		const { children } = currTopToken;
		if (children && patt.test(currTopToken.content)) {
			// We need to modify the children, replacing the delimiters
			// but not the inner content
			const noteTypeString = currTopToken.content.match(patt)![1] as
				| 'note'
				| 'warning'
				| 'info'
				| 'draft';

			// Since we know our RegEx matched, we can safely assume delimiters are at ends
			// and just outright replace those tokens
			const startToken = getHtmlBlock(state, 0, `<span class="${noteTypeString}">`);
			const endToken = getHtmlBlock(state, 0, `</span>`);
			children[0] = startToken;
			children[children.length - 1] = endToken;

			// Edge-case: Appears that DO removes line break between <$>[] and
			// first line of text. This prevents <br> in output between span and
			// next text node
			if (
				children[1] &&
				children[1].type === 'softbreak' &&
				children[2] &&
				children[2].type === 'text'
			) {
				// Remove softbreak
				children.splice(1, 1);
			}
		}
	}
	return true;
};

export const VariableHighlightRule: Rule = (state) => {
	const patt = /(.*)<\^>(.+?)<\^>(.*)/;
	const { tokens } = state;
	// console.log({ tokens });

	// There are a couple main ways that these tokens can show up, depending on
	// how they are used in the original markdown

	tokenRecurser(state, (currTopToken, currIndex, tokenArr) => {
		// In plain text areas (not code fences or inline), they will be put
		// into a single `inline` token, with either 1 child:
		// ['text'], content = `'Alpha <^>Bravo<^> Charlie!'`
		// Or, if using the `superscript` plugin, possibly 5 children
		// --> ['text', 'sup_open', 'text', 'sup_close', 'text']
		// --> [any preceding text + `<`, `^`, `>MyVarString<`, `^`, `>` + any closing text]
		if (currTopToken.type === 'inline' && currTopToken.children) {
			const { children } = currTopToken;
			// console.log(children);
			if (
				children.length === 1 &&
				children[0].type === 'text' &&
				patt.test(children[0].content)
			) {
				const [full, pre, varStr, post] = children[0].content.match(patt)!;
				// Child will be replaced by HTML block
				const replacementToken = getHtmlBlock(
					state,
					children[0].nesting,
					`${pre}<span class="highlight">${varStr}</span>${post}`
				);
				children[0] = replacementToken;
			} else {
				// Match `>varNameStr<`
				const innerTextPatt = /^>(.*)<$/;
				// console.log(children);
				for (let ci = 0; ci < children.length; ci++) {
					const child = children[ci];
					// The 5 children scenario
					if (
						child.type === 'sup_open' &&
						children[ci - 1] &&
						children[ci - 1].type === 'text' &&
						children[ci + 1] &&
						children[ci + 1].type === 'text' &&
						innerTextPatt.test(children[ci + 1].content) &&
						children[ci + 2] &&
						children[ci + 2].type === 'sup_close' &&
						children[ci + 3] &&
						children[ci + 3].type === 'text'
					) {
						// Remove `<` from first token (text token)
						children[ci - 1].content = children[ci - 1].content.replace(/<$/, '');
						// Replace `>varNameStr<` inner text token with <span>
						const varStr = children[ci + 1].content.match(/^>(.*)<$/)![1];
						children[ci + 1] = getHtmlBlock(
							state,
							children[ci + 1].nesting,
							`<span class="highlight">${varStr}</span>`
						);
						// Remove `>` from last text token
						children[ci + 3].content = children[ci + 3].content.replace(/^>/, '');
						// DELETE sup_open and sup_close
						children.splice(ci + 2, 1);
						children.splice(ci, 1);

						break;
					}
				}
			}
		}

		// This is for inline code blocks, NOT fenced
		if (currTopToken.type === 'code_inline') {
			// A little more complicated than just outright string replacement
			// In order to not have MDIT escape out <span>, we have to change
			// to raw HTML block, and recompose <code></code> entirely within it
			// Note: We don't have to search for and remove <code></code> delims,
			// since token type `code_inline` omits them from `.content`
			tokenArr[currIndex] = getHtmlBlock(
				state,
				currTopToken.nesting,
				`<code>${SpanWrapVars(currTopToken.content)}</code>`
			);
		}

		// Variable replacement in fenced code blocks should be handled separately
		// since there is a lot that has to be manipulated, and it might not
		// make sense to mutate the tokens here instead of the fenced block rule
	});

	return true;
};

export const FencedCodeBlockRule: Rule = (state) => {
	tokenRecurser(state, (token, index, tokenArr) => {
		if (token.type === 'fence' && token.tag === 'code') {
			// Capture language string. Example: `js`
			const lang = token.info;
			// Make sure to catch and span wrap <^>varString<^> blocks
			// and also make sure only one line break between code end and </code> tag
			const rawInnerCode = SpanWrapVars(token.content.trimEnd());
			tokenArr[index] = getHtmlBlock(
				state,
				token.nesting,
				`<pre class="code-pre "><code class="code-highlight language-${lang}">${rawInnerCode}\n</code></pre>`
			);
		}
	});

	return true;
};
