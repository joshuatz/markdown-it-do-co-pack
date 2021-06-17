import type { PluginWithOptions } from 'markdown-it';
import {
	FencedCodeBlockRule,
	HeadingsRule,
	NotesRule,
	SpacingRule,
	VariableHighlightRule,
} from './special-rules';
import type { MarkdownIt } from './types';
import { docoFlavoredReplacer } from './utils';

/**
 * All rules, in an ordered array
 *  - So far, rules should not care about order, but could in the future
 */
const OrderedRules = [
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
	{
		name: 'do_headings',
		ruleFn: HeadingsRule,
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
	rules?: 'default' | 'all' | Array<RuleName>;
}

function applyLowLevelDefaults(md: MarkdownIt) {
	// This will reset to default settings, good baseline
	md.configure('default');

	// These are different from MDIT defaults
	md.options.html = true;
	md.options.breaks = true;
	md.options.quotes = `“”“`;
	md.options.typographer;

	// Because md.options.typographer = false, we have to manually enable smartquotes
	// md.enable('smartquotes');

	// Use `<br>` instead of MDIT default of `<br>\n`
	// https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/renderer.js#L111-L113
	md.renderer.rules.softbreak = (tokens, idex, options) => {
		return options.breaks ? (options.xhtmlOut ? '<br />' : '<br>') : '\n';
	};

	// DO has some interesting replacements
	/**
	 * We are overriding the default text renderer
	 * @see https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/renderer.js#L116-L118
	 */
	const coreTextRule = md.renderer.rules.text!;
	md.renderer.rules.text = (tokens, index, options, env, self) => {
		let text = tokens[index].content;
		return docoFlavoredReplacer(text);
	};
}

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
