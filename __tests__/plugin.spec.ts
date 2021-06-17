/**
 * @file These tests should cover the entire plugin, and cover the intersection of multiple rules working together
 */

import { normalize } from 'path';
import { readdir, readFile } from 'fs-extra';
import MarkdownIt = require('markdown-it');
import DoAuthoringMdItPlugin, { DoPluginOptions } from '../src';
import assert = require('assert');

const FIXTURES_DIR_PATH = normalize(`${__dirname}/fixtures`);

const getAbsPath = (filename: string) => {
	return normalize(`${FIXTURES_DIR_PATH}/${filename}`);
};

// Initialize
const mdItInstance = new MarkdownIt();
mdItInstance.use<DoPluginOptions>(DoAuthoringMdItPlugin, {
	rules: 'all',
});

describe('Tests entire plugin', async () => {
	const testFiles = await readdir(FIXTURES_DIR_PATH);
	testFiles.forEach(async (filename) => {
		if (/-input\.md$/.test(filename)) {
			it.skip(`Should properly render test file ${filename}`, async () => {
				const inputFileContents = (await readFile(getAbsPath(filename))).toString();
				const outputFilePath = getAbsPath(filename.replace('-input.md', '-output.txt'));
				const outputFileContents = (await readFile(outputFilePath)).toString();
				const rendered = mdItInstance.render(inputFileContents);
				assert.strictEqual(rendered, outputFileContents);
			});
		}
	});
});
