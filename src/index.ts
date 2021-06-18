import type { PluginWithOptions } from 'markdown-it';
import {
	FencedCodeBlockRule,
	HeadingsRule,
	LinksRule,
	NotesRule,
	SpacingRule,
	VariableHighlightRule,
} from './special-rules';
import type { MarkdownIt, RenderRule } from './types';
import { docoEscape } from './utils';

/**
 * All rules, in an ordered array
 *  - The behavior of certain rules is affected by the order they are loaded on, since prior rules can mutate the token chain
 */
const OrderedRules = [
	{
		name: 'do_headings',
		ruleFn: HeadingsRule,
	},
	{
		name: 'do_links',
		ruleFn: LinksRule,
	},
	{
		name: 'do_notes',
		ruleFn: NotesRule,
	},
	{
		name: 'do_variable_highlights',
		ruleFn: VariableHighlightRule,
	},
	{
		name: 'do_code_blocks',
		ruleFn: FencedCodeBlockRule,
	},
	// This must always come last!
	{
		name: 'do_spacing',
		ruleFn: SpacingRule,
	},
] as const;

type RuleName = typeof OrderedRules[number]['name'];
type RulePair = typeof OrderedRules[number];
const AllRules: RuleName[] = OrderedRules.map((rp) => rp.name);
const DefaultRules = AllRules.filter((name) => name !== 'do_spacing');

const RulesByName: Record<RuleName, RulePair> = OrderedRules.reduce((running, curr) => {
	running[curr.name] = curr;
	return running;
}, {} as Record<RuleName, RulePair>);

interface DoPluginOptions {
	/**
	 * Which rules to load.
	 *  - Default = all, excluding spacing
	 */
	rules?: 'default' | 'all' | Array<RuleName>;
}

function applyLowLevelDefaults(md: MarkdownIt) {
	// This will reset to default settings, good baseline
	md.configure('default');

	// These are different from MDIT defaults
	md.options.breaks = true;
	md.options.linkify = true;

	// Use `<br>` instead of MDIT default of `<br>\n`
	// https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/renderer.js#L111-L113
	md.renderer.rules.softbreak = (tokens, idex, options) => {
		return options.breaks ? (options.xhtmlOut ? '<br />' : '<br>') : '\n';
	};

	// DO does not process `~~text~~` as strikethrough
	md.disable('strikethrough');

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

	// DO has some interesting replacements
	/**
	 * We are overriding the default text renderer
	 * @see https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/renderer.js#L116-L118
	 */
	const TextRendererOverride: RenderRule = (tokens, index) => {
		let text = tokens[index].content;
		return docoEscape(text);
	};
	md.renderer.rules.text = TextRendererOverride;
}

/**
 * Main plugin
 *  - You can pass this directly to `markdownIt.use()`
 * @example
 * ```js
 * const mdItInstance = new MarkdownIt();
 * mdItInstance.use(DoAuthoringMdItPlugin, {
 *     rules: 'all',
 * });
 * ```
 * @param md
 * @param options
 */
const DoAuthoringMdItPlugin: PluginWithOptions<DoPluginOptions> = (md, options) => {
	// Before loading custom rules, load some defaults that DO uses
	applyLowLevelDefaults(md);

	let selectedRulesByName = DefaultRules;

	if (options) {
		if (Array.isArray(options.rules)) {
			// Deduplicate
			selectedRulesByName = options.rules.filter((val, index, arr) => {
				return arr.indexOf(val) == index;
			});
		} else if (options.rules === 'all') {
			selectedRulesByName = AllRules;
		}
	}

	// Process rules in order defined, not order in arg
	OrderedRules.forEach((rule) => {
		if (selectedRulesByName.indexOf(rule.name) !== -1) {
			md.core.ruler.push(rule.name, rule.ruleFn);
		}
	});
};

export { applyLowLevelDefaults, DoAuthoringMdItPlugin, NotesRule, RulesByName };
export type { DoPluginOptions };
export default DoAuthoringMdItPlugin;
