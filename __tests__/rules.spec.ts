import MarkdownIt = require('markdown-it');
import assert = require('assert');
import { applyLowLevelDefaults, DoAuthoringMdItPlugin, NotesRule, Rules } from '../src';
import { FencedCodeBlockRule, VariableHighlightRule } from '../src/special-rules';
// @ts-ignore
import Superscript = require('markdown-it-sup');

function checkRenders(
	mdIt: MarkdownIt,
	checks: Array<{
		input: string;
		expected: string;
	}>,
	allowTrailingLineBreak = true
) {
	checks.forEach((c) => {
		const rendered = mdIt.render(c.input);
		try {
			assert.strictEqual(rendered, c.expected);
		} catch (firstErr) {
			if (allowTrailingLineBreak) {
				try {
					assert.strictEqual(rendered, c.expected + '\n');
				} catch (secondErr) {
					throw firstErr;
				}
			} else {
				throw firstErr;
			}
		}
	});
}

describe('Tests Individual Rules', () => {
	let mdItInstance: MarkdownIt;

	const reset = () => {
		mdItInstance = new MarkdownIt({
			html: true,
			breaks: true,
		});
		applyLowLevelDefaults(mdItInstance);
	};
	beforeEach(() => {
		reset();
	});

	describe('Tests notes rule', () => {
		beforeEach(() => {
			mdItInstance.use((md) => {
				md.core.ruler.push('do_notes', NotesRule);
			});
		});

		it('should handle notes', () => {
			checkRenders(mdItInstance, [
				{
					input: `<$>[draft]\r\n**Draft:** This diagram will be updated in the next revision.\n<$>`,
					expected: `<p><span class="draft"><strong>Draft:</strong> This diagram will be updated in the next revision.<br></span></p>\n`,
				},
			]);
		});
	});

	describe('Tests variable highlighting rule', () => {
		beforeEach(() => {
			mdItInstance.use((md) => {
				md.core.ruler.push('do_variable_highlights', VariableHighlightRule);
			});
		});

		it('should handle inline variables, mixed with text', () => {
			checkRenders(mdItInstance, [
				// This should get parsed as inline token, with 1 text child
				{
					input: `Hello <^>Joshua<^>!`,
					expected: `<p>Hello <span class="highlight">Joshua</span>!</p>`,
				},
			]);
		});

		it('should handle inline variables, inside inline code', () => {
			checkRenders(mdItInstance, [
				{
					input: 'My sample is `hello <^>Joshua<^>, it is <^>Monday<^>!`, which has two values filled by vars.',
					expected: `<p>My sample is <code>hello <span class="highlight">Joshua</span>, it is <span class="highlight">Monday</span>!</code>, which has two values filled by vars.</p>`,
				},
				{
					input: '`<^>var<^>`',
					expected: `<p><code><span class="highlight">var</span></code></p>`,
				},
			]);
		});

		it('should handle conflicts with superscript plugin', () => {
			mdItInstance.use(Superscript);
			checkRenders(mdItInstance, [
				// Because of the Superscript plugin, if our rule is loaded last
				// then this will get parsed into an inline token with 5 children
				// (see implementation for details)
				{
					input: `Hello <^>Joshua<^>!`,
					expected: `<p>Hello <span class="highlight">Joshua</span>!</p>`,
				},
			]);
		});
	});

	describe('Tests code fence rule', () => {
		beforeEach(() => {
			mdItInstance.use((md) => {
				md.core.ruler.push('do_code_blocks', FencedCodeBlockRule);
			});
		});

		it('Should handle standard fenced code blocks', () => {
			checkRenders(mdItInstance, [
				{
					input: '```md\n# Title\n```',
					expected: `<pre class="code-pre "><code class="code-highlight language-md"># Title\n</code></pre>`,
				},
			]);
		});

		it('should handle variables, inside fenced code blocks', () => {
			checkRenders(mdItInstance, [
				{
					input: "```js\nvar myName = '<^>joshua<^>';\n```",
					expected: `<pre class="code-pre "><code class="code-highlight language-js">var myName = '<span class="highlight">joshua</span>';\n</code></pre>`,
				},
			]);
		});
	});
});
