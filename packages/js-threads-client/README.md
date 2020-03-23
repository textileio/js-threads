# js-threads-client

[![Made by Textile](https://img.shields.io/badge/made%20by-Textile-informational.svg?style=popout-square)](https://textile.io)
[![Chat on Slack](https://img.shields.io/badge/slack-slack.textile.io-informational.svg?style=popout-square)](https://slack.textile.io)
[![Threads version](https://img.shields.io/badge/dynamic/json?style=popout-square&color=3527ff&label=Threads&prefix=v&query=%24.dependencies%5B%27%40textile%2Fthreads-client-grpc%27%5D.version&url=https%3A%2F%2Fraw.githubusercontent.com%2Ftextileio%2Fjs-threads-client%2Fmaster%2Fpackage-lock.json)](https://github.com/textileio/go-threads)
[![GitHub license](https://img.shields.io/github/license/textileio/js-threads-client.svg?style=popout-square)](./LICENSE)
[![Build status](https://img.shields.io/github/workflow/status/textileio/js-threads-client/lint_test/master.svg?style=popout-square)](https://github.com/textileio/js-threads-client/actions?query=branch%3Amaster)

> Textile's JS client for interacting with remote Threads

Go to [the docs](https://docs.textile.io/) for more about Textile.

Join us on our [public Slack channel](https://slack.textile.io/) for news, discussions, and status updates. [Check out our blog](https://medium.com/textileio) for the latest posts and announcements.

## Table of Contents

-   [Install](#install)
-   [Usage](#usage-in-typescript)
-   [React Native](#react-native)
-   [Docs](#docs)
-   [Contributing](#contributing)
-   [Changelog](#changelog)
-   [License](#license)

## Install

```
npm install @textile/threads-client
```

## Usage in Typescript

**create a threads client**

```js
import {Client} from '@textile/threads-client'

client = new Client()
```

**create a threads client using Textile APIs**

```js
import {API} from '@textile/textile'
import {Client} from '@textile/threads-client'

const api = new API({
    token: '<project token>',
    deviceId: '<user id>'
})
await api.start()

const client = new Client(api.threadsConfig)
```


**create a store**

```js
const store = await client.newDB()
await client.newCollection(store.id, 'Folder2P', schema)
```

**join a db by invite**

```js
const db = await client.newDB()
await client.newCollection(db.id, 'Folder2P', schema)
try {
  const some = await client.startFromAddress(
    db.id,
    '/ip4/127.0.0.1/tcp/4006/p2p/12D3KooWS2QMPk53mi6xzjr6j87bB9NDfn6NnnQWFc31p86SwpBW/thread/bafktbzj3z4gc7x44dc7izjieurbboybszntx6vapj3umytpilvuqjva',
    'stAhc51y6tnTdDGxSzA9rrSgjudzenwF6YcMAKK5Dm2seEmQi55DfGXcxzco',
    'j6YMX423ugWRRTXsfeHCzRLgBTQ95H1u7r35MZ6mKYTN7rLgdRvq1Efb2PBL')
} catch(err) {
  console.log(err)
}
```

**get all instances**

```js
const found = await client.find(this.finderID, 'Folder2P', {})
console.debug('found:', found.instancesList.length)
this.folders = found.instancesList.map((instance) => instance).map((obj) => {
  return new YourModel(obj)
})
```

**add an instance**

```js
// matches YourModel and schema
const created = await client.instanceCreate(this.finderID, 'Folder2', [{
  some: 'data',
  numbers: [1, 2, 3]
}])
```


## React Native

The following has been tested on **Android Only**.

`js-thread-client` should be compatible with React Native. Here are some helpful pointers if you find issues testing it out.

### Connecting to the threads daemon

You can run the daemon released as part of the early preview. To do so, 

```sh
git clone git@github.com:textileio/go-threads.git
cd go-threads
go run threadsd/main.go
```

**Make daemon available to RN**

You can make the daemon API port available to your app with,

```sh
adb reverse tcp:6007 tcp:6007
```

Altenatively, you can ensure this is run whenever you run your app by modifying your `package.json` as follows.

```json
{
  ...
  "scripts": {
    ...
    "bind": "adb reverse tcp:6007 tcp:6007",
    "android": "npm run bind && npx react-native run-android",
    ...
  },
  ...
}
```

Then, run your app with,

```sh
npm run android
```

### Buffer not found

`js-threads-client` relies on Buffer being available. To make `Buffer` available in your project, you may need to introduce a shim. Here are the steps.

**install rn-nodeify**

read more about [rn-nodeify](https://github.com/tradle/rn-nodeify#readme).

```js
npm install -G rn-nodeify
```

**run nodeify in the root of your project**

```js
rn-nodeify --install buffer --hack
```

This will create a `shim.js` in the root of your project. You need to import this at the top of your apps entry file (e.g. `indes.js`). 

The top of `index.js` would look like, 

```js
require('./shim')
...
```

**add nodeify to your postinstall**

Ensure that the shim is still configured after any module updates. Inside `package.json` add the following line to your `scripts` tag,

```json
{
  ...
  "scripts": {
    ...
    "postinstall": "rn-nodeify --install buffer --hack"
  }
}
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
