const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const authRouter = require('../routes/auth');

test('Auth router mounts correctly', () => {
  const app = express();
  app.use('/auth', authRouter);
  
  const routes = authRouter.stack.map(layer => layer.route.path);
  assert.ok(routes.includes('/register'));
  assert.ok(routes.includes('/login'));
  assert.ok(routes.includes('/me'));
});
