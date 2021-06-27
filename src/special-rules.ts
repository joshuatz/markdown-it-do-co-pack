import type { AnchorOptions } from 'markdown-it-anchor';
import MarkdownItAnchor from 'markdown-it-anchor';
import { RulesByName } from './index.js';
import { MarkdownIt, RuleCore, Token } from './types.js';
import {
	codeBlockEscape,
	docoEscape,
	getHtmlBlock,
	getIsRuleEnabled,
	getNewLineToken,
	HtmlReplacements,
	processTextForVars,
	runReplacers,
	tokenRecurser,
} from './utils.js';

/**
 * This rule handles inline notes
 * @example
 * ```md
 * <$>[warning]
 * **Warning:** Use this to warn users.
 * <$>
 * ```
 */
export const NotesRule: RuleCore = (state) => {
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
			const startToken = getHtmlBlock(state, 0, `<span class='${noteTypeString}'>`); // They've used single quotes for this one very specific class spot...
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

/**
 * Rule to highlight text marked as a "variable", with the special delimiters
 * @example
 * ```md
 * Test files are in `<^>project_root<^>/__tests__`
 * ```
 * - Any variable sections are turned into inline spans, with highlight class
 */
export const VariableHighlightRule: RuleCore = (state) => {
	// NOTE: not using /g to avoid index changing with .test()
	const patt = /(.*)<\^>(.+?)<\^>(.*)/m;

	// There are a couple main ways that these tokens can show up, depending on
	// how they are used in the original markdown

	function processTextToken(token: Token): Token {
		if (patt.test(token.content)) {
			return getHtmlBlock(
				state,
				token.nesting,
				processTextForVars({
					text: token.content,
					nonVarTextProcessor: docoEscape,
					varTextProcessor: docoEscape,
				})
			);
		}

		return token;
	}

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
				// Child will be replaced by HTML block
				children[0] = processTextToken(children[0]);
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

		if (token.type === 'text' && patt.test(token.content)) {
			// Have to use HTML block to avoid MDIT escaping out <span>
			tokenArr[index] = processTextToken(token);
		}

		// This is for inline code blocks, NOT fenced
		if (token.type === 'code_inline') {
			// A little more complicated than just outright string replacement
			// In order to not have MDIT escape out <span>, we have to change
			// to raw HTML block, and recompose <code></code> entirely within it
			// Note: We don't have to search for and remove <code></code> delimiters,
			// since token type `code_inline` omits them from `.content`
			tokenArr[index] = getHtmlBlock(
				state,
				token.nesting,
				`<code>${processTextForVars({
					text: token.content,
					varTextProcessor: state.md.utils.escapeHtml,
					nonVarTextProcessor: state.md.utils.escapeHtml,
				})}</code>`
			);
		}

		// Variable replacement in fenced code blocks should be handled separately
		// since there is a lot that has to be manipulated, and it might not
		// make sense to mutate the tokens here instead of the fenced block rule
	});

	return true;
};

/**
 * Rule for fenced code blocks, delimited in Markdown with the three backticks
 *  - There is a lot of processing that goes on in this rule
 *  - Overlap between this, variable highlighting, and spacing
 */
export const FencedCodeBlockRule: RuleCore = (state) => {
	const spacingRuleIsActive = getIsRuleEnabled(state.md, RulesByName.do_spacing.name);
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
			let rawInnerCode = '';
			/** Any extra classes to be injected into `<pre>` */
			let extraPreClasses: string[] = [];
			/**
			 * Any text that needs to come immediately before ending code tags
			 *  - Line break will _not_ be used between this text and closing tags
			 */
			let extraStringBeforeClosingCodeTags = '';

			// Capture language string. Example: `js`
			// Warning: May be empty!
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
				const liOpenHtml = `<li class="line" data-prefix="${
					commandPrefix === '>' ? commandPrefix : docoEscape(commandPrefix)
				}">`;

				const escapeLine = (lineStr: string) => {
					return processTextForVars({
						text: lineStr,
						nonVarTextProcessor: codeBlockEscape,
						varTextProcessor: codeBlockEscape,
					});
				};

				processedCodeLines[0] = `<ul class="prefixed">${liOpenHtml}${escapeLine(
					processedCodeLines[0]
				)}`;
				processedCodeLines.forEach((line, index) => {
					// Looks like empty lines are preserved if they come in-between other command lines
					if (index > 0 && (index !== processedCodeLines.length - 1 || line.length)) {
						processedCodeLines[index] = `</li>${liOpenHtml}${escapeLine(line)}`;
					}
				});
				// Close out final list item, and entire list, inline with code closing tags
				extraStringBeforeClosingCodeTags = `</li></ul>`;

				// Each line has been escaped as we went, so no extra escaping needed
				rawInnerCode = processedCodeLines.join('\n');
			} else {
				// This is not a `command` block
				rawInnerCode = processTextForVars({
					text: processedCodeLines.join('\n'),
					nonVarTextProcessor: codeBlockEscape,
					varTextProcessor: codeBlockEscape,
				});
			}

			// Make sure only one line break between code end and </code> tag
			rawInnerCode = rawInnerCode.trimEnd();

			if (labels.secondary) {
				// secondary label is actually inserted directly inside <code>
				rawInnerCode =
					`<div class="secondary-code-label " title="${labels.secondary}">${labels.secondary}</div>` +
					rawInnerCode;
			}

			const preOpenBlock = `<pre class="code-pre ${extraPreClasses.join(' ')}">`;
			let codeOpenBlock = `<code>`;
			if (lang) {
				codeOpenBlock = `<code class="code-highlight language-${lang}">`;
			}

			// With strict DO spacing rules, there is no `\n` between adjacent code blocks
			let hasFinalLineBreak = true;
			if (
				spacingRuleIsActive &&
				tokenArr[index + 1] &&
				tokenArr[index + 1].type === 'fence'
			) {
				hasFinalLineBreak = false;
			}

			let renderCode = `${preOpenBlock}${codeOpenBlock}${rawInnerCode}\n${extraStringBeforeClosingCodeTags}</code></pre>${
				hasFinalLineBreak ? '\n' : ''
			}`;

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
export const SpacingRule: RuleCore = (state) => {
	// We could hook into a lower-level rule, but this approach here does not require
	// precise ordering of hooks or relying on named rules
	tokenRecurser(state, (token, index, tokenArr) => {
		// DO uses an extra line break after certain tags...
		const addAfterTagTypes = [
			'paragraph_close',
			'softbreak',
			'bullet_list_close',
			'heading_close',
			'blockquote_close',
		];

		// ...but, not if certain tags follow
		const skipBeforeTypes = ['list_item_close', 'html_block', 'fence', 'blockquote_close'];

		// ... although adds extra if certain tags follow
		const addExtraBeforeTypes: string[] = ['paragraph_open'];

		if (addAfterTagTypes.includes(token.type)) {
			let nextToken = tokenArr[index + 1];
			if (nextToken && skipBeforeTypes.includes(nextToken.type)) {
				return;
			}

			tokenArr.splice(index + 1, 0, getNewLineToken(state, token.nesting));

			nextToken = tokenArr[index + 1];

			if (nextToken && addExtraBeforeTypes.includes(nextToken.type)) {
				tokenArr.splice(index + 1, 0, getNewLineToken(state, token.nesting));
			}
		}

		// Note: There is an additional spacing rule not processed here - see fenced code block rule and final line break
	});

	return true;
};

/**
 * Rule for headings, as well their associated `anchors`
 *  - Uses `markdown-it-anchor` for some anchor pre-processing, before applying internal rules
 */
export const HeadingsRule: RuleCore = (state) => {
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
				push: (name: string, callback: RuleCore) => {
					callback(state);
				},
			},
		},
	};
	MarkdownItAnchor(Interceptor as MarkdownIt, anchorOptions);

	// Actual heading text content is handled through text renderer

	return true;
};

/**
 * Because rules don't execute right away, this is a separate init function for LinksRule, since it needs to patch the internal methods of MDIT
 *  - This should be run if loading LinksRule. However, if using the standard Plugin loader, no need, since this should automatically be called.
 */
export const LinksPatchInternals = (md: MarkdownIt) => {
	// DO does not auto-convert MD links `[]()` if missing protocol (https{1,})
	// This is a little klunky, but was an easy spot to hook into MDIT's link internals to override the default behavior
	const originalParseLinkDestination = md.helpers.parseLinkDestination;
	md.helpers.parseLinkDestination = (str, pos, max) => {
		const failRes = {
			ok: false,
			pos: 0,
			lines: 0,
			str: '',
		};

		// Call original func to get result, including URL
		const originalRes = originalParseLinkDestination(str, pos, max);
		const url = originalRes.str;

		// URLs with full protocol are OK
		if (/^https{0,1}\:\/\//i.test(url)) {
			return originalRes;
		}

		// Or, internal anchor links are OK
		if (/^#.*/i.test(url)) {
			return originalRes;
		}

		return failRes;
	};

	// The same protocol required rule as above has to be applied to autolinker / plaintext links
	// A little complicated - MDIT injects protocol before even hitting `normalizeLink` or `validateLink` or `autoLinker`
	// Easiest place to hook is into matcher - see https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/rules_core/linkify.js#L65
	const originalLinkifyMatcher = md.linkify.match.bind(md.linkify);
	md.linkify.match = (str) => {
		let linkMatchResults = originalLinkifyMatcher(str);
		if (linkMatchResults) {
			linkMatchResults = linkMatchResults.filter((res) => {
				// Links can pass if they  have protocol, OR if they have www. prefix
				return res.schema !== '' || res.raw.startsWith('www.');
			});
		}
		return linkMatchResults;
	};

	// _Another_ exception to linkify for DO is if the links fall within unescaped HTML within a text token
	// Example: `<a href="{LINK}">Hello</a>` in raw MD would not get linkified
	// Easiest hook is linkify.test - see https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/rules_core/linkify.js#L62
	const originalLinkifyTest = md.linkify.test.bind(md.linkify);
	md.linkify.test = (str) => {
		// Link open
		if (/^<a[>\s]/i.test(str)) {
			return false;
		}
		return originalLinkifyTest(str);
	};
};

/**
 * Rule applies to links
 *  - I _believe_ the nofollow part of this rule is only applied to the previewer tool, and not to actual published posts
 */
export const LinksRule: RuleCore = (state) => {
	tokenRecurser(state, (token) => {
		if (token.type === 'link_open') {
			token.attrSet('rel', 'nofollow');
		}
	});

	return true;
};

/**
 * This rule attempts to find and handle HTML comments. Implementation is a little complicated when MDIT has HTML turned off, because comments can end up spanning multiple nodes, with content in-between start and end
 * @example `<!-- HTML Comment -->`
 * @example
 * ```md
 * HTML comments can span multiple lines, and start & end anywhere, <!-- like
 *
 * === hello ====
 *
 * ...this
 * -->
 * ```
 */
export const HtmlCommentsRule: RuleCore = (state) => {
	function unescapeBrackets(input: string) {
		let output = input.replace(/&lt;/g, '<');
		output = output.replace(/&gt;/g, '>');
		return output;
	}

	if (!state.md.options.html) {
		const entireChainLength = state.tokens.length;
		tokenRecurser(state, (token, index, tokenArr) => {
			const prevToken = tokenArr[index - 1];
			const nextToken = tokenArr[index + 1];
			const content = unescapeBrackets(token.content);
			// avoid splicing in middle of <p>
			let spliceStart = prevToken && prevToken.type === 'paragraph_open' ? index - 1 : index;

			if (token.type !== 'inline') {
				return;
			}

			// HTML comment contained in single token, empty when removed
			if (runReplacers(content, [HtmlReplacements['comments']]) === '') {
				const chopNum = nextToken && nextToken.type === 'paragraph_close' ? 3 : 1;
				if (chopNum < entireChainLength) {
					tokenArr.splice(spliceStart, chopNum);
					return {
						tokenArr,
						nextIndex: spliceStart,
					};
				}
			}

			// This handles an HTML comment that spans multiple tokens
			if (content.includes('<!--') && !content.includes('-->')) {
				let endFound = false;

				let spliceEnd = spliceStart;

				if (content !== '<!--') {
					// Content might be something like `hello <!-- inside`
					token.content = content.split('<!--')[0];
					// Don't remove token entirely!
					spliceStart--;
				}

				// Try to find end of HTML comment, starting after current
				for (let e = spliceStart; e < tokenArr.length; e++) {
					const eToken = tokenArr[e];
					const eTokenContent = unescapeBrackets(eToken.content);

					if (eTokenContent.includes('-->') && eToken.type === 'inline') {
						// avoid splitting in middle of <p>
						const nextToken = tokenArr[e + 1];
						spliceEnd = nextToken && nextToken.type === 'paragraph_close' ? e + 1 : e;

						if (eTokenContent !== '-->') {
							eToken.content = eTokenContent.split('-->')[1];
							// Don't remove token entirely!
							spliceEnd = spliceEnd - 2;
						}

						// Stop here!
						endFound = true;
						break;
					}
				}

				const chopNum = spliceEnd - spliceStart + 1;

				if (endFound) {
					tokenArr.splice(spliceStart, chopNum);
					return {
						tokenArr,
						// back-peddling, since we just removed chunk
						nextIndex: spliceStart,
					};
				}
			}
		});
	}

	return true;
};
