import type { AnchorOptions } from 'markdown-it-anchor';
import { MarkdownIt, Rule } from './types';
import { getHtmlBlock, getNewLineToken, SpanWrapVars, tokenRecurser } from './utils';
import MarkdownItAnchor = require('markdown-it-anchor');

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

	// There are a couple main ways that these tokens can show up, depending on
	// how they are used in the original markdown

	tokenRecurser(state, (token, index, tokenArr) => {
		// In plain text areas (not code fences or inline), they will be put
		// into a single `inline` token, with either 1 child:
		// ['text'], content = `'Alpha <^>Bravo<^> Charlie!'`
		// Or, if using the `superscript` plugin, possibly 5 children
		// --> ['text', 'sup_open', 'text', 'sup_close', 'text']
		// --> [any preceding text + `<`, `^`, `>MyVarString<`, `^`, `>` + any closing text]
		if (token.type === 'inline' && token.children) {
			const { children } = token;
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
		if (token.type === 'code_inline') {
			// A little more complicated than just outright string replacement
			// In order to not have MDIT escape out <span>, we have to change
			// to raw HTML block, and recompose <code></code> entirely within it
			// Note: We don't have to search for and remove <code></code> delims,
			// since token type `code_inline` omits them from `.content`
			tokenArr[index] = getHtmlBlock(
				state,
				token.nesting,
				`<code>${SpanWrapVars(token.content)}</code>`
			);
		}

		// Variable replacement in fenced code blocks should be handled separately
		// since there is a lot that has to be manipulated, and it might not
		// make sense to mutate the tokens here instead of the fenced block rule
	});

	return true;
};

export const FencedCodeBlockRule: Rule = (state) => {
	const { escapeHtml } = state.md.utils;
	tokenRecurser(state, (token, index, tokenArr) => {
		if (token.type === 'fence' && token.tag === 'code') {
			const labels: {
				primary: null | string;
				secondary: null | string;
				full: boolean;
			} = {
				primary: null,
				secondary: null,
				full: false,
			};
			let commandPrefix: string | null = null;

			const rawCodeLines = token.content.split(/\r\n|\n|\r/gm);
			const processedCodeLines: string[] = [];
			/** Any extra classes to be injected into `<pre>` */
			let extraPreClasses: string[] = [];
			/**
			 * Any text that needs to come immediately before ending code tags
			 *  - Line break will _not_ be used between this text and closing tags
			 */
			let extraStringBeforeClosingCodeTags = '';

			// Capture language string. Example: `js`
			let lang = token.info;

			// Capture DO labels (special feature)
			// There are two label types, primary (just `label`) and secondary
			// EDGE CASE: Parser is flexible, and labels can come in any order,
			// and even handle accidental multiples - will just use first of
			// each type
			const labelPatt = /^\[(label|secondary_label) (.+)\]$/i;
			for (let i = 0; i < rawCodeLines.length; i++) {
				let drop = false;

				if (!labels.full && labelPatt.test(rawCodeLines[i])) {
					const matches = rawCodeLines[i].match(labelPatt)!;
					const labelType = matches[1].toLowerCase() as 'label' | 'secondary_label';
					const labelVal = matches[2];
					const key = labelType === 'label' ? 'primary' : 'secondary';
					labels[key] = labelVal;

					// Remove the label line from showing up in the actual code code
					drop = true;

					// Check if we are done
					if (labels.primary && labels.secondary) {
						labels.full = true;
					}
				}

				if (!drop) {
					processedCodeLines.push(rawCodeLines[i]);
				}
			}

			// Special - command prefixes
			// Options are: `command`, `super_user` or `custom_prefix(prefix)`
			const customPrefixPatt = /^custom_prefix\((.+)\)$/i;
			if (lang === 'command' || lang === 'super_user' || customPrefixPatt.test(lang)) {
				let commandStr = lang;

				// All commands assume `bash` lang type, and override MDIT lang
				lang = 'bash';

				if (commandStr === 'command') {
					commandPrefix = '$';
				} else if (commandStr === 'super_user') {
					commandPrefix = '#';
				} else {
					// Custom
					commandPrefix = commandStr.match(customPrefixPatt)![1];
					commandStr = 'custom_prefix';
				}

				extraPreClasses.push(commandStr, 'prefixed');

				// Wrap all lines in custom `<ul><li></li></ul>`
				// To have complete parity with the MD preview tool, line breaks are a little odd
				// it breaks them right before closing tags, so `<ul><li>line 1\n</li><li>line 2\n</li></ul>
				const liOpenHtml = `<li class="line" data-prefix="${escapeHtml(commandPrefix)}">`;
				processedCodeLines[0] = `<ul class="prefixed">${liOpenHtml}${processedCodeLines[0]}`;
				processedCodeLines.forEach((line, index) => {
					// Looks like empty lines are preserved if they come in-between other command lines
					if (index > 0 && (index !== processedCodeLines.length - 1 || line.length)) {
						processedCodeLines[index] = `</li>${liOpenHtml}${line}`;
					}
				});
				// Close out final list item, and entire list, inline with code closing tags
				extraStringBeforeClosingCodeTags = `</li></ul>`;
			}

			// Make sure to catch and span wrap <^>varString<^> blocks
			// and also make sure only one line break between code end and </code> tag
			let rawInnerCode = SpanWrapVars(processedCodeLines.join('\n')).trimEnd();

			if (labels.secondary) {
				// secondary label is actually inserted directly inside <code>
				rawInnerCode =
					`<div class="secondary-code-label " title="${labels.secondary}">${labels.secondary}</div>` +
					rawInnerCode;
			}

			let renderCode = `<pre class="code-pre ${extraPreClasses.join(
				' '
			)}"><code class="code-highlight language-${lang}">${rawInnerCode}\n${extraStringBeforeClosingCodeTags}</code></pre>\n`;

			if (labels.primary) {
				// Primary label is inserted before entire rest of code, outside
				// of the <pre> wrapper
				renderCode =
					`<div class="code-label " title="${labels.primary}">${labels.primary}</div>` +
					renderCode;
			}

			tokenArr[index] = getHtmlBlock(state, token.nesting, renderCode);
		}
	});

	return true;
};

/**
 * This rule affects line breaks / spacing between elements, and comes with a few caveats
 *  - It is not really necessary, as the browser doesn't really care about spacing between elements
 *  - It should always come last, since spacing is highly dependent on what tokens are next to each other
 *  - This could probably be optimized further
 */
export const SpacingRule: Rule = (state) => {
	// We could hook into a lower-level rule, but this approach here does not require
	// precise ordering of hooks or relying on named rules
	tokenRecurser(state, (token, index, tokenArr) => {
		// DO uses an extra line break after certain tags...
		const addAfterTagTypes = [
			'paragraph_close',
			'softbreak',
			'bullet_list_close',
			'heading_close',
		];
		// ...but, not if certain tags follow
		const skipBeforeTypes = ['list_item_close'];
		if (addAfterTagTypes.includes(token.type)) {
			if (tokenArr[index + 1] && skipBeforeTypes.includes(tokenArr[index + 1].type)) {
				return;
			}

			tokenArr.splice(index, 1, token, getNewLineToken(state, token.nesting));
		}
	});

	return true;
};

export const HeadingsRule: Rule = (state) => {
	// Anchor transformation (e.g. `## Section -> <h2 id="section">Section</h2>)
	const anchorOptions: AnchorOptions & { tabIndex?: boolean } = {
		tabIndex: false,
		slugify: function (slug) {
			// Warning: Order is pretty important for several steps
			/**
			 * These characters are immediately stripped, without replacement
			 */
			const strippedChars = ['!', '@', '#', '$', '%', '^', '*', '(', ')', '+', '=', '~', '`'];
			const specialCharReplacements = [
				{
					find: /&/g,
					replace: `-amp`,
				},
				{
					find: /"/g,
					replace: `-quot`,
				},
				{
					find: /'/g,
					replace: `-39`,
				},
			];
			specialCharReplacements.forEach((c) => {
				slug = slug.replace(c.find, c.replace);
			});
			slug = slug
				.split('')
				.map((c) => {
					if (strippedChars.includes(c)) {
						return '';
					}
					return c;
				})
				.join('');
			// Replace single spaced sep with just sep
			slug = slug.replace(/ - /g, '-');
			// Lowercase
			slug = slug.toLowerCase();
			// Replace spaces with dashes
			slug = slug.replace(/[ ]{1,}/g, '-');
			// Multiple dashes are collapsed / combined
			slug = slug.replace(/-{2,}/g, '-');
			return slug;
		},
	};

	/**
	 * This is _not_ how to normally add rules, but some tricky stuff is needed since I'm piggybacking a third-party rule onto my own.
	 *  - This is a mock of the MarkdownIt instance
	 *  - If I were to load the MarkdownItAnchor plugin via state.md.use, or even state.md.core.ruler.push, it would end up in a state where anchor pushes its rule the stack, but due to loading order, doesn't get called with the correct token chain
	 */
	const Interceptor = {
		core: {
			ruler: {
				push: (name: string, callback: Rule) => {
					callback(state);
				},
			},
		},
	};
	MarkdownItAnchor(Interceptor as MarkdownIt, anchorOptions);

	// Actual heading text content is handled through text renderer

	return true;
};
