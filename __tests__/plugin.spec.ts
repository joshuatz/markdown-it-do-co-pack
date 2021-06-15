import MarkdownIt = require("markdown-it");
import assert = require("assert");
import {
	applyLowLevelDefaults,
	DoAuthoringMdItPlugin,
	NotesRule,
	Rules,
} from "../src";

describe("Tests Plugin", () => {
	describe("Tests Individual Rules", () => {
		let mdItInstance: MarkdownIt;
		beforeEach(() => {
			mdItInstance = new MarkdownIt({
				html: true,
				breaks: true,
			});
			applyLowLevelDefaults(mdItInstance);
		});
		it("should handle notes", () => {
			mdItInstance.use((md) => {
				md.core.ruler.push("do_notes", NotesRule);
			});
			const input = `<$>[draft]\r\n**Draft:** This diagram will be updated in the next revision.\n<$>`;
			const expected = `<p><span class="draft"><strong>Draft:</strong> This diagram will be updated in the next revision.<br></span></p>\n`;
			const rendered = mdItInstance.render(input);
			assert.strictEqual(rendered, expected);
		});
	});
});
