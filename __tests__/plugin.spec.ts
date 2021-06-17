/**
 * @file These tests should cover the entire plugin, and cover the intersection of multiple rules working together
 */

import { normalize } from 'path';
import { ensureDir, readdir, readFile, writeFile } from 'fs-extra';
import MarkdownIt = require('markdown-it');
import DoAuthoringMdItPlugin, { DoPluginOptions } from '../src';
import assert = require('assert');

const DEBUG_DIR_PATH = normalize(`${__dirname}/../debug-out`);
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
	// await ensureDir(DEBUG_DIR_PATH);
	const testFiles = await readdir(FIXTURES_DIR_PATH);
	testFiles.forEach(async (filename) => {
		if (/-input\.md$/.test(filename)) {
			it.skip(`Should properly render test file ${filename}`, async () => {
				const filenameBase = filename.replace('-input.md', '');
				const inputFileContents = (await readFile(getAbsPath(filename))).toString();
				const expectedOutFilePath = getAbsPath(`${filenameBase}-expected.txt`);
				const expectedOutFileContents = (await readFile(expectedOutFilePath)).toString();
				const rendered = mdItInstance.render(inputFileContents);
				try {
					assert.strictEqual(rendered, expectedOutFileContents);
				} catch (e) {
					await writeFile(
						normalize(`${DEBUG_DIR_PATH}/${filenameBase}-render.html`),
						rendered
					);
					throw e;
				}
			});
		}
	});
});
