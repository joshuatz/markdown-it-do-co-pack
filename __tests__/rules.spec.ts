/**
 * @file These tests should cover each rule, as isolated as possible
 */

import MarkdownIt = require('markdown-it');
import assert = require('assert');
import { applyLowLevelDefaults, DoAuthoringMdItPlugin, NotesRule, Rules } from '../src';
import { FencedCodeBlockRule, ParagraphsRule, VariableHighlightRule } from '../src/special-rules';
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

	describe('Tests paragraph rules', () => {
		it.skip('should handle paragraphs, and related spacing', () => {
			checkRenders(mdItInstance, [
				{
					input: 'paragraph one\n\nparagraph two\nno break here\n\n- list\n\nanother paragraph',
					expected:
						'<p>paragraph one</p>\n\n<p>paragraph two<br>\nno break here</p>\n\n<ul>\n<li>list</li>\n</ul>\n\n<p>another paragraph</p>\n\n',
				},
			]);
		});
	});

	describe('Tests headline rules', () => {
		it.skip('should handle headings', () => {
			checkRenders(mdItInstance, [
				{
					input: '# Title (H1)\nText\n## Sub-Section (H2)\n- List',
					expected:
						'<h1 id="title-h1">Title (H1)</h1>\n\n<p>Text</p>\n\n<h2 id="sub-section-h2">Sub-Section (H2)</h2>\n\n<ul>\n<li>List</li>\n</ul>\n\n',
				},
			]);
		});
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

		it('should handle standard fenced code blocks', () => {
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

		it('should handle "primary" DO "labels" inside fenced code blocks', () => {
			checkRenders(mdItInstance, [
				{
					input: '```js\n[label /home/joshua/test.js]\nasync function run() {\n    console.log("hello");\n}\nrun().then(process.exit(0));\n```',
					expected:
						'<div class="code-label " title="/home/joshua/test.js">/home/joshua/test.js</div><pre class="code-pre "><code class="code-highlight language-js">async function run() {\n    console.log("hello");\n}\nrun().then(process.exit(0));\n</code></pre>\n',
				},
			]);
		});

		it('should handle "secondary" DO "labels" inside fenced code blocks', () => {
			checkRenders(mdItInstance, [
				{
					input: '```ts\n[secondary_label main]\nfunction main() {\n  const str: string = "hello";\n  console.log(str);\n}\n```',
					expected:
						'<pre class="code-pre "><code class="code-highlight language-ts"><div class="secondary-code-label " title="main">main</div>function main() {\n  const str: string = "hello";\n  console.log(str);\n}\n</code></pre>\n',
				},
			]);
		});

		it('should handle a mixture of label types, limiting to one of each', () => {
			checkRenders(mdItInstance, [
				// Ordered correctly
				{
					input: '```js\n[label C:\tempalpha_bravo.js]\n[secondary_label Main]\n// Code comment\nfunction main() {\n  console.log("test");\n}\n```',
					expected:
						'<div class="code-label " title="C:\tempalpha_bravo.js">C:\tempalpha_bravo.js</div><pre class="code-pre "><code class="code-highlight language-js"><div class="secondary-code-label " title="Main">Main</div>// Code comment\nfunction main() {\n  console.log("test");\n}\n</code></pre>\n',
				},
				// Ordered incorrectly, but should still be handled correctly
				{
					input: '```md\n[secondary_label ABC123]\n[label /home/joshua/todo/t.md]\n - Take out trash\n```',
					expected:
						'<div class="code-label " title="/home/joshua/todo/t.md">/home/joshua/todo/t.md</div><pre class="code-pre "><code class="code-highlight language-md"><div class="secondary-code-label " title="ABC123">ABC123</div> - Take out trash\n</code></pre>\n',
				},
				// Both ordered incorrectly, and user tried to add more than one of each label type!
				{
					input: '```js\n[secondary_label Hello]\n[seconary_label render raw]\n[label C:\temp\test.js]\nfunction main() {\n  console.log("test");\n}\n```',
					expected:
						'<div class="code-label " title="C:\temp\test.js">C:\temp\test.js</div><pre class="code-pre "><code class="code-highlight language-js"><div class="secondary-code-label " title="Hello">Hello</div>[seconary_label render raw]\nfunction main() {\n  console.log("test");\n}\n</code></pre>\n',
				},
			]);
		});

		it('should handle special `command` code fenced blocks', () => {
			checkRenders(mdItInstance, [
				// Regular command
				// ```command
				{
					input: '```command\nsudo systemctl reload apache2\n```',
					expected:
						'<pre class="code-pre command prefixed"><code class="code-highlight language-bash"><ul class="prefixed"><li class="line" data-prefix="$">sudo systemctl reload apache2\n</li></ul></code></pre>\n',
				},
				// root command
				// ```super_user
				{
					input: '```super_user\nsystemctl reload apache2\necho "hello from root"\n```',
					expected:
						'<pre class="code-pre super_user prefixed"><code class="code-highlight language-bash"><ul class="prefixed"><li class="line" data-prefix="#">systemctl reload apache2\n</li><li class="line" data-prefix="#">echo "hello from root"\n</li></ul></code></pre>\n',
				},
				// custom prefixed
				// ```custom_prefix(mysql>)
				// ```custom_prefix(node>)
				{
					input: '```custom_prefix(node>)\nconsole.log("test")\nconsole.log("hello");\n```',
					expected:
						'<pre class="code-pre custom_prefix prefixed"><code class="code-highlight language-bash"><ul class="prefixed"><li class="line" data-prefix="node&gt;">console.log("test")\n</li><li class="line" data-prefix="node&gt;">console.log("hello");\n</li></ul></code></pre>\n',
				},
				// multi-line command block
				{
					input: '```command\nsudo systemctl reload apache2\nsudo restart\n```',
					expected:
						'<pre class="code-pre command prefixed"><code class="code-highlight language-bash"><ul class="prefixed"><li class="line" data-prefix="$">sudo systemctl reload apache2\n</li><li class="line" data-prefix="$">sudo restart\n</li></ul></code></pre>\n',
				},
			]);
		});

		it('Should handle all of the above options, mixed in the same code fence blocks', () => {
			checkRenders(mdItInstance, [
				{
					input: '```custom_prefix(my-prog>)\n[secondary_label init script]\n[label ./my-init.sh]\ninit\nload-file ./config.ini\n\nrun\n```',
					expected:
						'<div class="code-label " title="./my-init.sh">./my-init.sh</div><pre class="code-pre custom_prefix prefixed"><code class="code-highlight language-bash"><div class="secondary-code-label " title="init script">init script</div><ul class="prefixed"><li class="line" data-prefix="my-prog&gt;">init\n</li><li class="line" data-prefix="my-prog&gt;">load-file ./config.ini\n</li><li class="line" data-prefix="my-prog&gt;">\n</li><li class="line" data-prefix="my-prog&gt;">run\n</li></ul></code></pre>\n',
				},
			]);
		});
	});
});
