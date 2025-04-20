/* 공용 유틸 함수 */

function randInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampLog (arr, limit = 10_000) {
  return arr.length > limit ? arr.slice(-limit) : arr;
}

module.exports = { randInt, clampLog };
