import type { PluginWithOptions } from 'markdown-it';
import { NotesRule } from './special-rules';
import type { MarkdownIt, Rule } from './types';

import MarkdownItAnchor = require('markdown-it-anchor');
import type { AnchorOptions } from 'markdown-it-anchor';

type RuleNames = 'do_notes' | 'do_variable_highlights';
const RuleNamesArr: RuleNames[] = ['do_notes', 'do_variable_highlights'];

/**
 * All rules, in an ordered array
 *  - So far, rules should not care about order, but could in the future
 */
const Rules: Array<{
	name: RuleNames;
	ruleFn: Rule;
}> = [
	{
		name: 'do_notes',
		ruleFn: NotesRule,
	},
];

interface PluginOptions {
	rules?: Array<RuleNames>;
}

function applyLowLevelDefaults(md: MarkdownIt) {
	// Anchor transformation (e.g. `## Section -> <h2 id="section">Section</h2>)
	const anchorOptions: AnchorOptions & { tabIndex?: boolean } = {
		tabIndex: false,
		slugify: (slug) => {
			// DO removes parenthesis from slugs
			slug = slug.replace(/[()]/g, '');
			// https://github.com/valeriangalliat/markdown-it-anchor/blob/8a4acd04277ab4ad4f69746407d2e515a89487db/index.js#L85
			// @ts-ignore
			return MarkdownItAnchor.defaults.slugify(slug);
		},
	};
	md.use(MarkdownItAnchor, anchorOptions);

	// Use `<br>` instead of MDIT default of `<br>\n`
	// https://github.com/markdown-it/markdown-it/blob/064d602c6890715277978af810a903ab014efc73/lib/renderer.js#L111-L113
	md.renderer.rules.softbreak = (tokens, idex, options) => {
		return options.breaks ? (options.xhtmlOut ? '<br />' : '<br>') : '\n';
	};

	// This will reset to default settings, good baseline
	md.configure('default');

	// These are different from MDIT defaults
	md.options.html = true;
	md.options.breaks = true;
}

const DoAuthoringMdItPlugin: PluginWithOptions<PluginOptions> = (md, options) => {
	// Before loading custom rules, load some defaults that DO uses
	applyLowLevelDefaults(md);

	let selectedRulesByName = RuleNamesArr;
	if (options && options.rules) {
		// Deduplicate
		selectedRulesByName = options.rules.filter((val, index, arr) => {
			return arr.indexOf(val) == index;
		});
	}

	// Process rules in order defined
	Rules.forEach((rule) => {
		if (selectedRulesByName.indexOf(rule.name) !== -1) {
			md.core.ruler.push(rule.name, rule.ruleFn);
		}
	});
};

export { applyLowLevelDefaults, DoAuthoringMdItPlugin, NotesRule, Rules };
export default DoAuthoringMdItPlugin;
