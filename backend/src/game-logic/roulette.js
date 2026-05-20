const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function spin() {
  return Math.floor(Math.random() * 37); // 0–36
}

function evaluateBet(bet, n) {
  const { type, amount } = bet;

  switch (type) {
    case 'straight':
      return bet.number === n ? amount * 36 : 0; // 35:1
    case 'split':   // cheval – 2 adjacent numbers
      return Array.isArray(bet.numbers) && bet.numbers.includes(n) ? amount * 18 : 0; // 17:1
    case 'corner':  // carré – 4 numbers
      return Array.isArray(bet.numbers) && bet.numbers.includes(n) ? amount * 9 : 0;  //  8:1
    case 'dozen': {
      if (n === 0) return 0;
      const d = n <= 12 ? 1 : n <= 24 ? 2 : 3;
      return d === bet.which ? amount * 3 : 0; // 2:1
    }
    case 'column': {
      if (n === 0) return 0;
      // Board rows top→bottom: row1=[3,6,9...36](n%3==0), row2=[2,5,8...35](n%3==2), row3=[1,4,7...34](n%3==1)
      const col = n % 3 === 0 ? 1 : n % 3 === 2 ? 2 : 3;
      return col === bet.which ? amount * 3 : 0; // 2:1
    }
    case 'red':
      return RED_NUMBERS.has(n) ? amount * 2 : 0;
    case 'black':
      return n > 0 && !RED_NUMBERS.has(n) ? amount * 2 : 0;
    case 'odd':
      return n > 0 && n % 2 === 1 ? amount * 2 : 0;
    case 'even':
      return n > 0 && n % 2 === 0 ? amount * 2 : 0;
    case 'low':
      return n >= 1 && n <= 18 ? amount * 2 : 0;
    case 'high':
      return n >= 19 && n <= 36 ? amount * 2 : 0;
    default:
      return 0;
  }
}

module.exports = { spin, evaluateBet, RED_NUMBERS };
