import MarkdownIt = require('markdown-it');
import type { RuleCore } from 'markdown-it/lib/parser_core';
import Token = require('markdown-it/lib/token');

export type StateCore = InstanceType<MarkdownIt['core']['State']>;
export type { MarkdownIt, Token };
export type Rule = RuleCore;
