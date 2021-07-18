# Markdown-it DigitalOcean Community Plugin (Unofficial)
> Unofficial [Markdown-it](https://github.com/markdown-it/markdown-it) plugin, to apply the same rules and Markdown conversion features as [the Markdown Preview Tool](https://www.digitalocean.com/community/markdown).

[![CI Badge](https://github.com/joshuatz/markdown-it-do-co-pack/actions/workflows/nodejs.yml/badge.svg)](https://github.com/joshuatz/markdown-it-do-co-pack/actions/workflows/nodejs.yml) [![NPM Badge](https://img.shields.io/npm/v/markdown-it-do-co-pack)](https://www.npmjs.com/package/markdown-it-do-co-pack) [![Code Coverage Badge](https://codecov.io/gh/joshuatz/markdown-it-do-co-pack/branch/main/graph/badge.svg)](https://codecov.io/gh/{USER}/{REPO}/branch/main)

## Abbreviations / Acronyms
Throughout documentation and source-code, there are a few terminology shortcuts used:

- `MDIT` = [Markdown-it](https://github.com/markdown-it/markdown-it)
- `MD` = `Markdown`
- `DO` = [DigitalOcean](https://www.digitalocean.com/)
	- `DOCO` = [DigitalOcean Community](https://www.digitalocean.com/community)

## Installation
```
npm i markdown-it-do-co-pack
```

NPM Registry: [markdown-it-do-co-pack](https://www.npmjs.com/package/markdown-it-do-co-pack)

## Usage
For how to use the DO Community flavor of Markdown, you can refer to:

- The [Markdown Preview Tool](https://www.digitalocean.com/community/markdown)
- The [DO Article Templates](https://github.com/do-community/do-article-templates)
- The [DO Formatting and Style Guide](https://do.co/style)

For using _this package_, there are a few different ways you can use it to transform Markdown:

### Usage - As a Plugin (Recommended)
The recommended way to use this package is as a Markdown-it plugin, which loads the entire pack of rules in one shot, or selectively based on the input options. This is recommended because:

- Some of the rules _rely_ on precise loading order, and the plugin automatically observes correct rule ordering
- This automatically runs `applyLowLevelDefaults` for you, which makes sure MDIT options align with what is needed to produce DO output
- The plugin loader will avoid duplicating rules

The plugin is exported as `DoAuthoringMdItPlugin`, as well as the `default` export from `index`. You can use it like so:

<details>
	<summary>Example Code - JS, ESM - All Rules</summary>

```js
import {DoAuthoringMdItPlugin} from 'markdown-it-do-co-pack';
import MarkdownIt from 'markdown-it';

const mdItInstance = new MarkdownIt();

mdItInstance.use(DoAuthoringMdItPlugin, {
	rules: 'all', // This can also be `default`, or an array of rule names
});

let input =
`
# Example

<$>[note]
**Note:** This is a special note!
<$>

Here is a <^>variable highlight<^>.
`


const output = mdItInstance.render(input);
console.log(output);

/**
 * Output:

<h1 id="example">Example</h1>

<p><span class='note'><strong>Note:</strong> This is a special note!<br></span></p>

<p>Here is a <span class="highlight">variable highlight</span>.</p>

 */
```
</details>

### Usage - Individual Rules
Although not recommended (see above), technically you can use each rule contained in this pack individually, if you so desire.

<details>
	<summary>Example: Individual Rule - With Plugin Loader</summary>

```js
const mdItInstance = new MarkdownIt();
mdItInstance.use(DoAuthoringMdItPlugin, {
	rules: ['do_notes']
});
```
</details>


<details>
	<summary>Example: Individual Rule - Without Plugin Loader</summary>

```js
import {RulesByName} from 'markdown-it-do-co-pack';
import MarkdownIt from 'markdown-it';

const mdItInstance = new MarkdownIt();

const {name: ruleName, ruleFn} = RulesByName.do_variable_highlights;

mdItInstance.core.ruler.push(ruleName, ruleFn);

let input =
`
In this sentence, <^>this<^> is a variable.
`


const output = mdItInstance.render(input);
console.log(output);
// <p>In this sentence, <span class="highlight">this</span> is a variable.</p>
```
</details>

### TypeScript Support
TypeScript definitions are included in this package.

The most important one for most users will be the `DoPluginOptions` interface, which helps avoid mistakes when loading the main plugin with `.use()`.

Because of how `.use()` takes generics, there are two ways I can recommend using the options type:

<details>
	<summary>With Generic Slot</summary>

This definitely requires that you have installed `@types/markdown-it`.

```ts
import {DoAuthoringMdItPlugin, DoPluginOptions} from 'markdown-it-do-co-pack';
import MarkdownIt from 'markdown-it';

const mdItInstance = new MarkdownIt();

mdItInstance.use<DoPluginOptions>(DoAuthoringMdItPlugin, {
	rules: 'all'
});
```
</details>

<details>
	<summary>Declaring options separately</summary>

You can also create options separately and explicitly type them:

```ts
import {DoAuthoringMdItPlugin, DoPluginOptions} from 'markdown-it-do-co-pack';
import MarkdownIt from 'markdown-it';

const mdItInstance = new MarkdownIt();

const options: DoPluginOptions = {
	rules: 'all'
}

mdItInstance.use(DoAuthoringMdItPlugin, options);
```
</details>


## Known Issues
Certain rules from other plugins can conflict with the rules contained within this pack. Furthermore, there is no way for me to predict which ones are going to conflict, nor can I audit them all manually, given the number of 3rd party plugins and rules for Markdown-it.

An example of a conflict is [the `math-inline` rule provided by the Markdown All in One VSCode extension](https://github.com/yzhang-gh/vscode-markdown/blob/f560819acc2175691dd5d5d809e3329c50d18039/syntaxes/math_inline.markdown.tmLanguage.json) - it conflicts with DO's variable highlighting rule.


## Development

### Tests
The *expected* value for each render test is whatever [the official DigitalOcean Markdown preview tool](https://www.digitalocean.com/community/markdown) spits out (or, more specifically, whatever [the API](https://www.digitalocean.com/community/markdown/preview) returns)

- Per rule tests
	- Isolated rule tests are in [`rules.spec.ts`](__tests__/rules.spec.ts), and (try) to test each rule without consideration of the others
	- To make the strings easier to paste into JavaScript / TypeScript, I used [this CyberChef rule](https://gchq.github.io/CyberChef/#recipe=Find_/_Replace(%7B'option':'Regex','string':'%5C%5Cn'%7D,'%5C%5C%5C%5Cn',true,false,true,false)Find_/_Replace(%7B'option':'Regex','string':'%5C''%7D,'%22',true,false,true,false)Find_/_Replace(%7B'option':'Regex','string':'%5E%7C$'%7D,'%5C'',true,false,true,false)), and some manual escaping when applicable.
- Plugin tests
	- Plugin tests use text fixtures to make large tests easier to add
	- Test fixtures follow the pattern of `{name}-input.md` for the test input, and `{name}-expected.txt` for the expected (*rendered*) value generated by Markdown-it, when the plugin is used.

### Coverage
Coverage reports are generated by NYC / Istanbul. Use `test` to test with coverage, or `test:nocov` to test without it.

> 🚨 Warning: Coverage uploading is currently broken with CodeCov. I'm looking for a fix / alternative.

## Change Notes
Version | Date | Notes
--- | --- | ---
`1.0.0` | 6/28/2021 | Initial Release 🚀

## Disclaimers
> *DigitalOcean* is a registered trademark of DigitalOcean, LLC. This tool is not affiliated with nor endorsed by DigitalOcean or the DigitalOcean Community in any *official* capacity.

## About Me:

More About Me (Joshua Tzucker):

 - 🔗<a href="https://joshuatz.com/" rel="noopener" target="_blank">joshuatz.com</a>
 - 👨‍💻<a href="https://dev.to/joshuatz" rel="noopener" target="_blank">dev.to/joshuatz</a>
 - 💬<a href="https://twitter.com/1joshuatz" rel="noopener" target="_blank">@1joshuatz</a>
 - 💾<a href="https://github.com/joshuatz" rel="noopener" target="_blank">github.com/joshuatz</a>