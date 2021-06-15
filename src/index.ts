import type { PluginWithOptions } from 'markdown-it';
import { NotesRule } from './special-rules';
import type { MarkdownIt, Rule } from './types';

import MarkdownItAnchor = require('markdown-it-anchor');

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
	md.use(MarkdownItAnchor, {
		tabIndex: false,
	});

	// Use `<br>` instead of MDIT default of `<br>\n`
	md.renderer.rules.softbreak = (tokens, idex, options) => {
		return options.breaks ? (options.xhtmlOut ? '<br />' : '<br>') : '\n';
	};
}

const DoAuthoringMdItPlugin: PluginWithOptions<PluginOptions> = (
	md,
	options
) => {
	// Before loading custom rules, load some defaults that DO uses
	applyLowLevelDefaults(md);

	let selectedRulesByName = RuleNamesArr;
	if (options && options.rules) {
		// Dedupe
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
