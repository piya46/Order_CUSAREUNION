module.exports = (err, req, res, next) => {
  console.error(err);
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Bad request: invalid JSON' });
  }
  if (err.message && err.message.startsWith('Only images and PDF')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
};
