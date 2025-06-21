// Cursor generated mock authentication middleware
module.exports = function (req, res, next) {
  const user = req.header('x-user');
  if (!user) return res.status(401).json({ error: 'Missing user' });
  if (user === 'netrunnerX') req.user = { id: 'netrunnerX', role: 'admin' };
  else if (user === 'reliefAdmin') req.user = { id: 'reliefAdmin', role: 'admin' };
  else req.user = { id: user, role: 'contributor' };
  next();
}; 