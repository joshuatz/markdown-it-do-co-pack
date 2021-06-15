import type { PluginWithOptions } from "markdown-it";
import { getHtmlBlock } from "./utils";
import type { RuleCore } from "markdown-it/lib/parser_core";
import MarkdownItAnchor = require("markdown-it-anchor");
import type { MarkdownIt } from "./types";

type Rule = RuleCore;
type RuleNames = "do_notes" | "do_variable_highlights";
const RuleNamesArr: RuleNames[] = ["do_notes", "do_variable_highlights"];

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
const NotesRule: Rule = (state) => {
	const patt = /<\$>\[(.+)\].+<\$>$/ms;
	const { tokens } = state;
	// console.log(tokens[1].children);
	console.log(tokens);

	for (let x = 0; x < tokens.length; x++) {
		const currTopToken = tokens[x];
		const { children } = currTopToken;
		if (children && patt.test(currTopToken.content)) {
			// We need to modify the children, replacing the delimiters
			// but not the inner content
			const noteTypeString = currTopToken.content.match(patt)![1] as
				| "note"
				| "warning"
				| "info"
				| "draft";

			// Since we know our RegEx matched, we can safely assume delimiters are at ends
			// and just outright replace those tokens
			const startToken = getHtmlBlock(
				state,
				0,
				`<span class="${noteTypeString}">`
			);
			const endToken = getHtmlBlock(state, 0, `</span>`);
			children[0] = startToken;
			children[children.length - 1] = endToken;

			// Edge-case: Appears that DO removes line break between <$>[] and
			// first line of text. This prevents <br> in output between span and
			// next text node
			if (
				children[1] &&
				children[1].type === "softbreak" &&
				children[2] &&
				children[2].type === "text"
			) {
				// Remove softbreak
				children.splice(1, 1);
			}

			console.log(children);
		}
	}
	return true;
};

/**
 * All rules, in an ordered array
 *  - So far, rules should not care about order, but could in the future
 */
const Rules: Array<{
	name: RuleNames;
	ruleFn: Rule;
}> = [
	{
		name: "do_notes",
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
		return options.breaks ? (options.xhtmlOut ? "<br />" : "<br>") : "\n";
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
