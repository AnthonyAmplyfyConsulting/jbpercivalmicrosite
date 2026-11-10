import test from 'node:test';
import assert from 'node:assert/strict';
import { act, deal, publicHand, score, shuffledDeck } from '../worker/game.js';

const withCards = (...draws) => deal(draws.reverse());

test('each shuffled deck contains 52 unique cards', () => {
  const first = shuffledDeck();
  const second = shuffledDeck();
  assert.equal(first.length, 52);
  assert.equal(new Set(first).size, 52);
  assert.deepEqual([...first].sort(), [...second].sort());
  assert.notDeepEqual(first, second);
});

test('ace scoring works across multiple aces', () => {
  assert.equal(score(['AS', 'AC', '9H']), 21);
  assert.equal(score(['AS', 'AC', '9H', 'KD']), 21);
  assert.equal(score(['AS', '6S']), 17);
});

test('only an opening natural earns blackjack, and matching naturals push', () => {
  assert.equal(withCards('AS', '9D', 'KD', '6S').outcome, 'blackjack');
  assert.equal(withCards('AS', 'AH', 'KD', 'QS').outcome, 'push');
  assert.equal(withCards('JS', 'AH', '9D', 'QS').outcome, 'loss');
  const round = withCards('7S', '9D', '4D', '8S', 'KD');
  act(round, 'hit');
  assert.equal(round.outcome, 'win');
});

test('dealer stands on soft 17; dealer draws at 16; player bust ends the hand', () => {
  const soft17 = withCards('10S', 'AH', '8C', '6D');
  act(soft17, 'stand');
  assert.equal(soft17.outcome, 'win');
  assert.equal(soft17.dealer.length, 2);

  const draws = withCards('10S', '10H', '8C', '6D', 'KC');
  act(draws, 'stand');
  assert.equal(draws.outcome, 'win');
  assert.equal(draws.dealer.length, 3);

  const bust = withCards('KS', '10H', '8C', '6D', 'KC');
  act(bust, 'hit');
  assert.equal(bust.outcome, 'loss');
  assert.equal(bust.dealer.length, 2);
});

test('public state hides the dealer hole card and entire deck until resolution', () => {
  const round = withCards('6S', '10H', '8C', '6D', 'KC');
  const visible = publicHand({ revision: 1, state: JSON.stringify(round) });
  assert.deepEqual(visible.dealer, ['10H', null]);
  assert.equal(visible.dealerTotal, null);
  assert.equal(Object.hasOwn(visible, 'deck'), false);
  assert.equal(visible.code, undefined);
  act(round, 'stand');
  const resolved = publicHand({ revision: 2, state: JSON.stringify(round) });
  assert.deepEqual(resolved.dealer, ['10H', '6D', 'KC']);
  assert.match(resolved.code, /^[A-F0-9]{8}$/);
});
