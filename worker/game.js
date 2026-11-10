const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['S', 'H', 'C', 'D'];

function uniform(max) {
  const sample = new Uint32Array(1);
  const limit = 2 ** 32 - (2 ** 32 % max);
  do crypto.getRandomValues(sample); while (sample[0] >= limit);
  return sample[0] % max;
}

export function shuffledDeck() {
  const deck = suits.flatMap(suit => ranks.map(rank => rank + suit));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = uniform(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function score(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const rank = card.slice(0, -1);
    if (rank === 'A') {
      aces++;
      total++;
    } else total += Number(rank) || 10;
  }
  return total + (aces && total <= 11 ? 10 : 0);
}

function finish(round, outcome, reason) {
  round.outcome = outcome;
  round.reason = reason;
  round.code = crypto.randomUUID().slice(0, 8).toUpperCase();
}

export function deal(deck = shuffledDeck()) {
  const player = [deck.pop()];
  const dealer = [deck.pop()];
  player.push(deck.pop());
  dealer.push(deck.pop());
  const round = { deck, player, dealer, outcome: null, id: crypto.randomUUID() };
  const playerNatural = score(player) === 21;
  const dealerNatural = score(dealer) === 21;
  if (playerNatural && dealerNatural) finish(round, 'push', 'Both hands have blackjack.');
  else if (playerNatural) finish(round, 'blackjack', 'An ace and a ten-value card on the deal.');
  else if (dealerNatural) finish(round, 'loss', 'The dealer has blackjack.');
  return round;
}

export function act(round, action) {
  if (round.outcome) return;
  if (action === 'hit') round.player.push(round.deck.pop());
  const player = score(round.player);
  if (player > 21) {
    finish(round, 'loss', 'Your hand went over 21.');
    return;
  }
  if (action === 'hit' && player < 21) return;
  while (score(round.dealer) < 17) round.dealer.push(round.deck.pop());
  const dealer = score(round.dealer);
  if (dealer > 21) finish(round, 'win', 'The dealer went over 21.');
  else if (player > dealer) finish(round, 'win', 'Your hand beat the dealer.');
  else if (player < dealer) finish(round, 'loss', 'The dealer had the higher hand.');
  else finish(round, 'push', 'You and the dealer tied.');
}

export function publicHand(row) {
  if (!row) return null;
  const round = JSON.parse(row.state);
  return {
    id: round.id, revision: row.revision, outcome: round.outcome,
    player: round.player, playerTotal: score(round.player),
    dealer: round.outcome ? round.dealer : [round.dealer[0], null],
    dealerTotal: round.outcome ? score(round.dealer) : null,
    reason: round.reason, code: round.code
  };
}
