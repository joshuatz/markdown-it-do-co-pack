import MarkdownIt from 'markdown-it';
import type { RuleBlock } from 'markdown-it/lib/parser_block';
import type { RuleCore } from 'markdown-it/lib/parser_core';
import type { RuleInline } from 'markdown-it/lib/parser_inline';
import type { RenderRule } from 'markdown-it/lib/renderer';
import Token from 'markdown-it/lib/token';

export type StateCore = InstanceType<MarkdownIt['core']['State']>;
export type { MarkdownIt, Token, RenderRule, RuleBlock, RuleInline, RuleCore };
export type Rule = RuleBlock | RuleInline | RuleCore;
export interface InternalRuleTracker {
	name: string;
	enabled: boolean;
	fn: Function;
	alt: string[];
}
