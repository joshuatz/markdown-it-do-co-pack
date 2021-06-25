import { ok } from 'assert';
import fs from 'fs-extra';
const { readFile } = fs;
import MarkdownIt from 'markdown-it';
import { DoAuthoringMdItPlugin } from '../src/index.js';
import { getEsmDirname } from '../src/utils.js';

async function getPerf() {
	const testStrRaw = (
		await readFile(`${getEsmDirname(import.meta)}/../__tests__/fixtures/example-01-input.md`)
	).toString();
	const largeTestStr = new Array(200).fill(testStrRaw).join('\n');
	const mdItInstance = new MarkdownIt();
	mdItInstance.use(DoAuthoringMdItPlugin, {
		rules: 'all',
	});
	console.time('render');
	const output = mdItInstance.render(largeTestStr);
	console.timeEnd('render');
	ok(output.length > 1000);
}

getPerf().then(() => {
	process.exit(0);
});
