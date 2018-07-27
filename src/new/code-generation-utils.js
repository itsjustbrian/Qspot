const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function randomLetters(numLetters) {
  let letters = '';
  for (let i = 0; i < numLetters; i++) {
    const j = Math.floor(Math.random() * 26);
    letters += ALPHABET[j];
  }
  return letters;
}