import MarkdownIt = require('markdown-it');
import type { RuleCore } from 'markdown-it/lib/parser_core';
import type { RenderRule } from 'markdown-it/lib/renderer';
import Token = require('markdown-it/lib/token');

export type StateCore = InstanceType<MarkdownIt['core']['State']>;
export type { MarkdownIt, Token, RenderRule };
export type Rule = RuleCore;
