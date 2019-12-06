# js-threads-client

[![Made by Textile](https://img.shields.io/badge/made%20by-Textile-informational.svg?style=popout-square)](https://textile.io)
[![Chat on Slack](https://img.shields.io/badge/slack-slack.textile.io-informational.svg?style=popout-square)](https://slack.textile.io)
[![GitHub license](https://img.shields.io/github/license/textileio/js-threads-client.svg?style=popout-square)](./LICENSE)
[![CircleCI branch](https://img.shields.io/circleci/project/github/textileio/js-threads-client/master.svg?style=popout-square)](https://circleci.com/gh/textileio/js-threads-client)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=popout-square)](https://github.com/RichardLitt/standard-readme)

> Textile's JS client for interacting with remote Threads

Go to [the docs](https://docs.textile.io/) for more about Textile.

Join us on our [public Slack channel](https://slack.textile.io/) for news, discussions, and status updates. [Check out our blog](https://medium.com/textileio) for the latest posts and announcements.

## Table of Contents

-   [Install](#install)
-   [Tests](#tests)
-   [Contributing](#contributing)
-   [Changelog](#changelog)
-   [License](#license)

## Install

```
git clone git@github.com:textileio/js-threads-client.git
cd js-threads-client
npm i
```

If you want to run the tests in both browser and Nodejs, you'll need to install a recent [Java Development Kit (JDK)](https://www.oracle.com/technetwork/java/javase/downloads/index.html), and [Firefox](https://www.mozilla.org/en-CA/firefox/) or [Chrome](https://www.google.com/chrome/) browser.

## Tests

```
npm run test
```

Or to do just Nodejs or browser:

```
npm run test:{node,browser}
```

## Docs

To build the (Markdown-based) documentation output to the `docs` folder, run:

```
npm run docs
```

## Contributing

This project is a work in progress. As such, there's a few things you can do right now to help out:

-   **Ask questions**! We'll try to help. Be sure to drop a note (on the above issue) if there is anything you'd like to work on and we'll update the issue to let others know. Also [get in touch](https://slack.textile.io) on Slack.
-   **Open issues**, [file issues](https://github.com/textileio/js-threads-client/issues), submit pull requests!
-   **Perform code reviews**. More eyes will help a) speed the project along b) ensure quality and c) reduce possible future bugs.
-   **Take a look at the code**. Contributions here that would be most helpful are **top-level comments** about how it should look based on your understanding. Again, the more eyes the better.
-   **Add tests**. There can never be enough tests.

Before you get started, be sure to read our [contributors guide](./CONTRIBUTING.md) and our [contributor covenant code of conduct](./CODE_OF_CONDUCT.md).

## Changelog

[Changelog is published to Releases.](https://github.com/textileio/js-threads-client/releases)

## License

[MIT](LICENSE)
