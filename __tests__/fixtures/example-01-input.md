# Level 1 Heading - Welcome to the Test Fixture!

## Text
Here is a regular paragraph.

Let's try some more complex text: !@#$()^_~+_)&)*!^@%. 😀✨📄🚨🎉

And how about formatting. We can have _italics_, (_neat_), **bold**, or even ~~strikethrough~~.

### Blockquotes
I really like blockquotes - they feel like a very natural way to indicate notes in native Markdown, especially since they get turned into native HTML `<blockquote>` elements, which is understood by browsers and provides indentation right out of the box.

> Here is a blockquote example.

## Links
Here is an [inline link](https://joshuatz.com/), and the same, [but without the protocol](joshuatz.com).

Here are some links in a list:

- [Portfolio site](https://joshuatz.com/)
- [Google](https://www.google.com/)
- [Bing](https://www.bing.com/)
- [Bing without protocol](bing.com)
- [Non-https site](http://www.example.com)

And how about this - a URL pasted without the MD link syntax: https://www.google.com/.

And here are some more URLs, without MD link syntax, AND without protocol: www.google.com & google.com.

Or how about this, a link to another section within this page: [Text Section](#text)

## Code
There are a few different ways to embed code into Markdown files. You can use inline code formatting, like `$this`, or a separated code block (sometimes called a *fenced* code block), using triple backticks to start and stop:

```
hello from a code block!
```

You can also indicate the (coding) language used within the code block by placing the language specifier (e.g. `js`) on the right side of the three opening backticks:

```js
console.log("Hello from JS");
```

## Special DO Formatting
DO supports some special syntax within MD that is their own flavor - not part of the baseline MD specs.

### Notes
Here are some examples:

<$>[note]
**Note:** Use this for notes on a publication.
<$>

<$>[warning]
**Warning:** Use this to warn users.
<$>

<$>[info]
**Info:** Use this for product information.
<$>

<$>[draft]
**Draft:** Use this for notes in a draft publication.
<$>

### Variable Highlighting
DO supports _"variable highlighting"_, which is to say that any text enclosed within a special delimiter set gets highlighted, indicating the value is dynamic, and/or should be changed by the reader.

The delimiters are `<^>`, on both sides.

An inline plain text example is <^>this<^>, or you can do inline code, `like <^>this<^>...`,  or even within code blocks:

```js
const myName = '<^>Joshua<^>';
```

### Code Labels
Code labels in DO Markdown are a way to indicate to the reader extra contextual information about the code they are seeing, perhaps the filename it normally corresponds to.

There are regular labels (I call these *primary* labels), or *secondary* labels.

Here is a primary label:

```js
[label main.js]
alert('You are in main.js');
```

Here is a secondary label:

```
[secondary_label Console Output]
VM1059:1 Uncaught ReferenceError: myVar is not defined
```

And here is both together (this is permitted):

```php
[label server/index.php]
[secondary_label checkRights]
function checkRights($user) {
    //
}
```

### Code Commands
For showing terminal / shell input and output to the reader, DO supports some extra formatting and syntax, through command indicators. These typically set the default language of the code block to `bash`, and add the correct prefix in front of your commands.

Here are some examples:

```command
sudo systemctl reload apache2
```

```super_user
echo "Hello from SU!"
```

```custom_prefix(node>)
1 + 1
> 2
```