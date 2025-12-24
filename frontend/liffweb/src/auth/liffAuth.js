let _idToken = null;
let _userId = null;

export function setLiffAuth({ idToken, userId }) {
  _idToken = idToken || null;
  _userId = userId || null;
}

export function getLiffAuth() {
  return { idToken: _idToken, userId: _userId };
}
