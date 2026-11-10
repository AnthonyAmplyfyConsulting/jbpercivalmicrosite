const byId = id => document.getElementById(id);
const table = byId('table');
const intro = byId('intro');
const game = byId('game');
const coupon = byId('coupon');
const rules = byId('rules-dialog');
const hit = byId('hit');
const stand = byId('stand');
const replay = byId('replay');
const play = byId('play');
const rewardAgain = byId('reward-again');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const symbols = { S: '♠', H: '♥', C: '♣', D: '♦' };
const suitNames = { S: 'spades', H: 'hearts', C: 'clubs', D: 'diamonds' };
const names = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
const rewards = {
  blackjack: ['Blackjack', 'Free drink'],
  win: ['You win', '10% off'],
  loss: ['A little luck anyway', '5% off'],
  push: ['Push', '5% off']
};
const columns = (...ys) => ys.flatMap(y => [[32, y], [68, y]]);
const pips = {
  2: [[50, 36], [50, 106]],
  3: [[50, 35], [50, 71], [50, 107]],
  4: columns(35, 107), 5: [...columns(35, 107), [50, 71]],
  6: columns(35, 71, 107), 7: [...columns(35, 71, 107), [50, 53]],
  8: [...columns(35, 71, 107), [50, 53], [50, 89]],
  9: [...columns(33, 58, 84, 109), [50, 71]],
  10: [...columns(33, 58, 84, 109), [50, 46], [50, 96]]
};
let hand;
let busy = false;

function cardFace(code) {
  const suit = code.slice(-1);
  const rank = code.slice(0, -1);
  const pip = symbols[suit];
  const fill = 'HD'.includes(suit) ? '#a12532' : '#101a27';
  const index = `<g text-anchor="middle"><text x="12" y="18" font-size="17">${rank}</text><text x="12" y="30" font-size="13">${pip}</text></g>`;
  let center;
  if (rank === 'A') {
    center = `<text x="50" y="96" text-anchor="middle" font-size="73">${pip}</text>`;
  } else if (pips[rank]) {
    center = pips[rank].map(([x, y]) => `<text transform="translate(${x} ${y}) ${y > 71 ? 'rotate(180)' : ''}" text-anchor="middle" dominant-baseline="central" font-size="22">${pip}</text>`).join('');
  } else {
    center = `<path d="M27 27h46v88H27z" fill="none" stroke="${fill}"/><path d="M50 32l17 38-17 40-17-40z" fill="none" stroke="${fill}"/><text x="50" y="81" text-anchor="middle" font-size="31">${rank}</text><text x="50" y="53" text-anchor="middle" font-size="16">${pip}</text><text x="50" y="106" text-anchor="middle" font-size="16">${pip}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 142"><rect width="100" height="142" rx="6" fill="#f2eee4"/><g fill="${fill}" font-family="Georgia,serif">${index}<g transform="rotate(180 50 71)">${index}</g>${center}</g></svg>`;
}

function makeCard(code) {
  const card = new Image();
  card.className = 'card';
  card.draggable = false;
  if (code) {
    const rank = code.slice(0, -1);
    card.dataset.code = code;
    card.src = 'data:image/svg+xml,' + encodeURIComponent(cardFace(code));
    card.alt = `${names[rank] || rank} of ${suitNames[code.slice(-1)]}`;
  } else {
    card.src = '/back.svg';
    card.alt = 'Face-down card';
  }
  return card;
}

function updateControls() {
  play.disabled = busy;
  replay.disabled = busy;
  hit.disabled = busy || !hand || !!hand.outcome;
  stand.disabled = hit.disabled;
  hit.hidden = stand.hidden = !!hand?.outcome;
  rewardAgain.hidden = !hand?.outcome;
}

function settleCard(card) {
  const rect = card.getBoundingClientRect();
  const area = table.getBoundingClientRect();
  const x = area.right - rect.left - rect.width / 2 - area.width * .08;
  const y = area.top + area.height * .11 - rect.top;
  const tilt = getComputedStyle(card).getPropertyValue('--tilt').trim();
  return card.animate([
    { transform: `translate3d(${x}px,${y}px,0) rotate(20deg) scale(.88)`, opacity: 0 },
    { opacity: 1, offset: .2 },
    { transform: `translate3d(0,0,0) rotate(${tilt}) scale(1)`, opacity: 1 }
  ], { duration: 610, easing: 'cubic-bezier(.18,.68,.29,1)' }).finished;
}

async function addCard(container, code, animate) {
  const card = makeCard(code);
  await card.decode().catch(() => {});
  const moving = animate && !reduced.matches;
  const positions = moving ? Array.from(container.children, existing => [existing, existing.getBoundingClientRect()]) : [];
  container.classList.toggle('many', container.children.length >= 3);
  container.append(card);
  if (moving) {
    for (const [existing, before] of positions) {
      const after = existing.getBoundingClientRect();
      existing.animate(
        { translate: [`${before.x - after.x}px ${before.y - after.y}px`, '0px 0px'] },
        { duration: 420, easing: 'cubic-bezier(.18,.68,.29,1)' }
      );
    }
    await settleCard(card);
  }
}

async function revealHole(container, code, animate) {
  const original = container.children[1];
  const replacement = makeCard(code);
  await replacement.decode().catch(() => {});
  if (animate && !reduced.matches) {
    const tilt = getComputedStyle(original).getPropertyValue('--tilt').trim();
    const flip = (lift, yaw) => `perspective(500px) translateY(${lift}px) rotateZ(${tilt}) rotateY(${yaw}deg)`;
    const rest = flip(0, 0);
    await original.animate({ transform: [rest, flip(-5, 90)] },
      { duration: 245, easing: 'ease-in', fill: 'forwards' }).finished;
    original.replaceWith(replacement);
    await replacement.animate({ transform: [flip(-5, -90), rest] },
      { duration: 265, easing: 'ease-out' }).finished;
  } else original.replaceWith(replacement);
}

function showCoupon() {
  if (!hand?.outcome) return;
  const [heading, reward] = rewards[hand.outcome];
  byId('outcome').textContent = heading;
  byId('reward').textContent = reward;
  byId('reason').textContent = hand.reason;
  byId('code').textContent = hand.code;
  if (!coupon.open && !rules.open) coupon.showModal();
}

async function render(next, animate = true) {
  if (!next) {
    hand = null;
    game.hidden = true;
    table.classList.remove('in-game');
    intro.classList.remove('leaving');
    intro.hidden = false;
    return;
  }

  const isNew = hand?.id !== next.id;
  const player = byId('player');
  const dealer = byId('dealer');
  const entering = !intro.hidden;
  table.classList.add('in-game');
  if (entering) {
    intro.classList.add('leaving');
    if (animate && !reduced.matches) {
      await Promise.allSettled(intro.getAnimations().map(animation => animation.finished));
    }
    intro.hidden = true;
  }
  game.hidden = false;
  byId('dealer-total').textContent = 'Dealer';
  byId('player-total').textContent = 'Your hand';
  if (isNew) {
    player.replaceChildren();
    dealer.replaceChildren();
    player.classList.remove('many');
    dealer.classList.remove('many');
    await addCard(player, next.player[0], animate);
    await addCard(dealer, next.dealer[0], animate);
    await addCard(player, next.player[1], animate);
    await addCard(dealer, null, animate);
  }
  for (const card of next.player.slice(player.children.length)) await addCard(player, card, animate);
  byId('player-total').textContent = `Your hand · ${next.playerTotal}`;
  if (next.outcome) {
    if (!dealer.children[1].dataset.code) await revealHole(dealer, next.dealer[1], animate);
    for (const card of next.dealer.slice(dealer.children.length)) await addCard(dealer, card, animate);
    byId('dealer-total').textContent = `Dealer · ${next.dealerTotal}`;
  }
  hand = next;
  if (next.outcome) {
    if (animate && !reduced.matches) await new Promise(resolve => setTimeout(resolve, 380));
    showCoupon();
  }
}

async function move(action) {
  if (busy) return;
  busy = true;
  updateControls();
  byId('status').textContent = '';
  try {
    let revision = hand?.revision;
    if (action === 'deal' && !hand) {
      // Load the saved revision only after Play. Opening the link always shows the intro.
      const saved = await fetch('/api/hand');
      if (!saved.ok) throw new Error('The table could not connect. Try again.');
      revision = (await saved.json())?.revision;
    }
    const res = await fetch('/api/hand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, revision })
    });
    const body = await res.json();
    if (res.status === 409) {
      await render(body.hand, false);
      byId('status').textContent = body.error;
    } else if (!res.ok) throw new Error(body.error);
    else {
      if (coupon.open) coupon.close();
      await render(body);
    }
  } catch (error) {
    byId('status').textContent = error.message || 'The table could not connect. Try again.';
  } finally {
    busy = false;
    updateControls();
  }
}

byId('hero-cards').append(makeCard('AS'), makeCard(null));
play.addEventListener('click', () => move('deal'));
replay.addEventListener('click', () => move('deal'));
hit.addEventListener('click', () => move('hit'));
stand.addEventListener('click', () => move('stand'));
rewardAgain.addEventListener('click', showCoupon);
byId('rules').addEventListener('click', () => rules.showModal());
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}
updateControls();
