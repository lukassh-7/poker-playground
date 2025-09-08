# Poker Playground

Node.js scripting playground using the `pokersolver` library.

## Setup

```bash
npm install
```

## Run example

```bash
npm start
```

This runs `index.js`, which evaluates two example Texas Hold'em hands and prints their names, descriptions, and the winner using `pokersolver`.

## Library

- [pokersolver on npm](https://www.npmjs.com/package/pokersolver)

Example usage (from our `index.js`):

```js
const { Hand } = require('pokersolver');

const hand1 = Hand.solve(['Ad', 'As', 'Jc', 'Th', '2d', '3c', 'Kd']);
const hand2 = Hand.solve(['Ad', 'As', 'Jc', 'Th', '2d', 'Qs', 'Qd']);
const winners = Hand.winners([hand1, hand2]);

console.log('Winner(s):', winners.map((w) => w.toString()).join(' | '));
```

## License

MIT
