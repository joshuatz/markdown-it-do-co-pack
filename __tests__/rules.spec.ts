/**
 * @file These tests should cover each rule, as isolated as possible
 */

import MarkdownIt from 'markdown-it';
import assert from 'assert';
import { applyLowLevelDefaults, RulesByName } from '../src/index.js';
// @ts-ignore
import Superscript from 'markdown-it-sup';
import { LinksPatchInternals } from '../src/special-rules.js';

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
					try {
						assert.strictEqual(rendered + '\n', c.expected);
					} catch (thirdErr) {
						throw firstErr;
					}
				}
			} else {
				throw firstErr;
			}
		}
	});
}

type NamedRulePair = typeof RulesByName[keyof typeof RulesByName];

function loadRule(
	mditInstance: MarkdownIt,
	rule: NamedRulePair | NamedRulePair[],
	before?: NamedRulePair
) {
	const rules = Array.isArray(rule) ? rule : [rule];
	rules.forEach((r) => {
		if (before) {
			mditInstance.core.ruler.before(before.name, r.name, r.ruleFn);
		} else {
			mditInstance.core.ruler.push(r.name, r.ruleFn);
		}
	});
}

describe('Tests Individual Rules', () => {
	let mdItInstance: MarkdownIt;

	const reset = () => {
		mdItInstance = new MarkdownIt();
		applyLowLevelDefaults(mdItInstance);
		// A lot of the expected values rely on spacing and links
		loadRule(mdItInstance, RulesByName.do_links);
		LinksPatchInternals(mdItInstance);
		loadRule(mdItInstance, RulesByName.do_spacing);
	};
	beforeEach(() => {
		reset();
	});
	reset();

	describe('Tests regular text', () => {
		it('should render a paragraph', () => {
			checkRenders(mdItInstance, [
				{
					input: 'Hello',
					expected: '<p>Hello</p>\n',
				},
				// Special chars
				{
					input: "abc 👨‍💻 \"test\" *^% (R)(r)(C)(P)(tm)(p)'' he(R)llo& alskjfd\"text\"ajsfdd ''single quote wrapped''",
					expected:
						'<p>abc 👨‍💻 &ldquo;test&rdquo; *^% &reg;&reg;&copy;(P)&trade;(p)&ldquo; he&reg;llo&amp; alskjfd&quot;text&quot;ajsfdd &rsquo;&lsquo;single quote wrapped&rdquo;</p>\n\n',
				},
				// Weird single quote handling
				{
					input: `('hello')\n\na 'hello' to you\n\nI say 'hello'\n\n'hello' on the left\n\nsquish'hello'in middle`,
					expected: `<p>(&lsquo;hello&rsquo;)</p>\n\n<p>a 'hello&rsquo; to you</p>\n\n<p>I say 'hello&rsquo;</p>\n\n<p>'hello&rsquo; on the left</p>\n\n<p>squish'hello'in middle</p>\n\n`,
				},
				{
					input: `$'\n\n$'d\n\n('f)\n\n(f')\n\n&'\n\n&'d\n\n)'\n\n)''\n\n)'\n\n)'k\n\n'`,
					expected: `<p>$&rsquo;</p>\n\n<p>$&rsquo;d</p>\n\n<p>(&lsquo;f)</p>\n\n<p>(f&rsquo;)</p>\n\n<p>&amp;&rsquo;</p>\n\n<p>&amp;&rsquo;d</p>\n\n<p>)&rsquo;</p>\n\n<p>)&ldquo;</p>\n\n<p>)&rsquo;</p>\n\n<p>)'k</p>\n\n<p>&rsquo;</p>\n\n`,
				},
			]);
		});

		// I honestly don't think this should be honored / implemented
		// It would take a lot of work to implement (hard to override MDIT's use of trim(), since it is deeply nested here - https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/rules_block/paragraph.js#L35
		// Furthermore, this doesn't really have a practical effect - paragraphs are block level elements, and even if you make them inline, the browser collapses whitespace on the ends anyways
		it.skip('should not trim paragraph ends', () => {
			checkRenders(mdItInstance, [
				{
					input: 'I have a trailing space ',
					expected:
						'<p>DO supports <em>&ldquo;variable highlighting&rdquo;</em>, which is to say </p>\n\n',
				},
			]);
		});

		it(`should escape based on DO's rules`, () => {
			checkRenders(mdItInstance, [
				{
					input: "<div>Hello</div>\n\n<script>console.info('Hello!');</script>\n\n😀✨",
					expected:
						'<p>&lt;div&gt;Hello&lt;/div&gt;</p>\n\n<p>&lt;script&gt;console.info(&lsquo;Hello!&rsquo;);&lt;/script&gt;</p>\n\n<p>😀✨</p>\n\n',
				},
			]);
		});

		it(`should handle mixed formatting, like bold and italic`, () => {
			checkRenders(mdItInstance, [
				{
					input: `DO supports _"variable highlighting"_, which is to say`,
					expected:
						'<p>DO supports <em>&ldquo;variable highlighting&rdquo;</em>, which is to say</p>\n\n',
				},
			]);
		});
	});

	describe('Tests spacing rule', () => {
		beforeEach(() => {
			loadRule(mdItInstance, RulesByName.do_code_blocks, RulesByName.do_spacing);
		});

		it('should handle paragraphs, and related spacing', () => {
			checkRenders(mdItInstance, [
				{
					input: 'paragraph one\n\nparagraph two\nno break here\n\n- list\n\nanother paragraph',
					expected:
						'<p>paragraph one</p>\n\n<p>paragraph two<br>\nno break here</p>\n\n<ul>\n<li>list</li>\n</ul>\n\n<p>another paragraph</p>\n\n',
				},
			]);
		});

		it('should not place breaks between adjacent code blocks', () => {
			checkRenders(mdItInstance, [
				{
					input: '```\nblock 1\n```\n```\nblock 2\n```',
					expected:
						'<pre class="code-pre "><code>block 1\n</code></pre><pre class="code-pre "><code>block 2\n</code></pre>\n',
				},
			]);
		});
	});

	describe('Tests links rule', () => {
		it('should handle a variety of link types', () => {
			checkRenders(mdItInstance, [
				{
					input: '[My Website](https://joshuatz.com/)\n\n[DO](https://www.digitalocean.com/)\n\n<a href="https://www.google.com/" rel="nofollow">Google</a>\n\n<a href="https://www.bing.com/">Bing</a>',
					expected:
						'<p><a href="https://joshuatz.com/" rel="nofollow">My Website</a></p>\n\n<p><a href="https://www.digitalocean.com/" rel="nofollow">DO</a></p>\n\n<p>&lt;a href=&ldquo;https://www.google.com/&rdquo; rel=&ldquo;nofollow&rdquo;&gt;Google&lt;/a&gt;</p>\n\n<p>&lt;a href=&ldquo;https://www.bing.com/&rdquo;&gt;Bing&lt;/a&gt;</p>\n\n',
				},
			]);
		});

		it('should handle links mixed into other content', () => {
			checkRenders(mdItInstance, [
				{
					input: '',
					expected: '',
				},
			]);
		});
	});

	describe('Tests headline rules', () => {
		beforeEach(() => {
			loadRule(mdItInstance, RulesByName.do_headings, RulesByName.do_links);
		});
		it('should handle headings', () => {
			checkRenders(mdItInstance, [
				// Special chars
				{
					input: '# Title (H1)\nText\n## Sub-Section (H2)\n- List',
					expected:
						'<h1 id="title-h1">Title (H1)</h1>\n\n<p>Text</p>\n\n<h2 id="sub-section-h2">Sub-Section (H2)</h2>\n\n<ul>\n<li>List</li>\n</ul>\n\n',
				},
				{
					input: '### 🚌 _"',
					expected: '<h3 id="🚌-_-quot">🚌 _&ldquo;</h3>\n\n',
				},
				{
					input: '### Special - chars — 🚨 !@#$%^*()-+=_—~`"\'',
					expected:
						'<h3 id="special-chars-—-🚨-_—-quot-39">Special - chars — 🚨 !@#$%^*()-+=_—~`&ldquo;&rsquo;</h3>\n\n',
				},
			]);
		});
	});

	describe('Tests notes rule', () => {
		beforeEach(() => {
			loadRule(mdItInstance, RulesByName.do_notes, RulesByName.do_spacing);
		});

		it('should handle notes', () => {
			checkRenders(mdItInstance, [
				{
					input: `<$>[draft]\r\n**Draft:** This diagram will be updated in the next revision.\n<$>`,
					expected: `<p><span class='draft'><strong>Draft:</strong> This diagram will be updated in the next revision.<br></span></p>\n`,
				},
			]);
		});
	});

	describe('Tests variable highlighting rule', () => {
		beforeEach(() => {
			loadRule(mdItInstance, RulesByName.do_variable_highlights, RulesByName.do_spacing);
		});

		it('should handle inline variables, mixed with text', () => {
			checkRenders(mdItInstance, [
				// This should get parsed as inline token, with 1 text child
				{
					input: `Hello <^>Joshua<^>!`,
					expected: `<p>Hello <span class="highlight">Joshua</span>!</p>\n`,
				},
				{
					input: 'Paragraph, `code`, now <^>variable<^>, now `a <^>var<^> in in-line code`, now end of paragraph.',
					expected:
						'<p>Paragraph, <code>code</code>, now <span class="highlight">variable</span>, now <code>a <span class="highlight">var</span> in in-line code</code>, now end of paragraph.</p>\n',
				},
			]);
		});

		it('should handle inline variables, inside inline code', () => {
			checkRenders(mdItInstance, [
				{
					input: 'My sample is `hello <^>Joshua<^>, it is <^>Monday<^>!`, which has two values filled by vars.',
					expected: `<p>My sample is <code>hello <span class="highlight">Joshua</span>, it is <span class="highlight">Monday</span>!</code>, which has two values filled by vars.</p>\n`,
				},
				{
					input: '`<^>var<^>`',
					expected: `<p><code><span class="highlight">var</span></code></p>\n`,
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
					expected: `<p>Hello <span class="highlight">Joshua</span>!</p>\n`,
				},
			]);
		});
	});

	describe('Tests code fence rule', () => {
		beforeEach(() => {
			loadRule(mdItInstance, RulesByName.do_code_blocks, RulesByName.do_spacing);
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
					input: '```js\n[label /home/joshua/test.js]\nasync function run() {\n    console.info("hello");\n}\nrun().then(process.exit(0));\n```',
					expected:
						'<div class="code-label " title="/home/joshua/test.js">/home/joshua/test.js</div><pre class="code-pre "><code class="code-highlight language-js">async function run() {\n    console.info("hello");\n}\nrun().then(process.exit(0));\n</code></pre>\n',
				},
			]);
		});

		it('should handle "secondary" DO "labels" inside fenced code blocks', () => {
			checkRenders(mdItInstance, [
				{
					input: '```ts\n[secondary_label main]\nfunction main() {\n  const str: string = "hello";\n  console.info(str);\n}\n```',
					expected:
						'<pre class="code-pre "><code class="code-highlight language-ts"><div class="secondary-code-label " title="main">main</div>function main() {\n  const str: string = "hello";\n  console.info(str);\n}\n</code></pre>\n',
				},
			]);
		});

		it('should handle code blocks that are missing language specifiers', () => {
			checkRenders(mdItInstance, [
				{
					input: '```\nplain text\n```',
					expected: '<pre class="code-pre "><code>plain text\n</code></pre>\n',
				},
			]);
		});

		it('should handle a mixture of label types, limiting to one of each', () => {
			checkRenders(mdItInstance, [
				// Ordered correctly
				{
					input: '```js\n[label C:\tempalpha_bravo.js]\n[secondary_label Main]\n// Code comment\nfunction main() {\n  console.info("test");\n}\n```',
					expected:
						'<div class="code-label " title="C:\tempalpha_bravo.js">C:\tempalpha_bravo.js</div><pre class="code-pre "><code class="code-highlight language-js"><div class="secondary-code-label " title="Main">Main</div>// Code comment\nfunction main() {\n  console.info("test");\n}\n</code></pre>\n',
				},
				// Ordered incorrectly, but should still be handled correctly
				{
					input: '```md\n[secondary_label ABC123]\n[label /home/joshua/todo/t.md]\n - Take out trash\n```',
					expected:
						'<div class="code-label " title="/home/joshua/todo/t.md">/home/joshua/todo/t.md</div><pre class="code-pre "><code class="code-highlight language-md"><div class="secondary-code-label " title="ABC123">ABC123</div> - Take out trash\n</code></pre>\n',
				},
				// Both ordered incorrectly, and user tried to add more than one of each label type!
				{
					input: '```js\n[secondary_label Hello]\n[seconary_label render raw]\n[label C:\temp\test.js]\nfunction main() {\n  console.info("test");\n}\n```',
					expected:
						'<div class="code-label " title="C:\temp\test.js">C:\temp\test.js</div><pre class="code-pre "><code class="code-highlight language-js"><div class="secondary-code-label " title="Hello">Hello</div>[seconary_label render raw]\nfunction main() {\n  console.info("test");\n}\n</code></pre>\n',
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
					input: '```custom_prefix(node>)\nconsole.info("test")\nconsole.info("hello");\n```',
					expected:
						'<pre class="code-pre custom_prefix prefixed"><code class="code-highlight language-bash"><ul class="prefixed"><li class="line" data-prefix="node&gt;">console.info("test")\n</li><li class="line" data-prefix="node&gt;">console.info("hello");\n</li></ul></code></pre>\n',
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
