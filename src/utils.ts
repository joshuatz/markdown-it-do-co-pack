import type { Nesting } from "markdown-it/lib/token";
import type { StateCore } from "./types";

export function getHtmlBlock(
	state: StateCore,
	nesting: Nesting,
	content?: string
) {
	const token = new state.Token("html_block", "", nesting);
	token.content = content || "";
	return token;
}
