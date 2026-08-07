const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const boardsRouter = require('../routes/boards');

test('Boards router mounts correctly', () => {
  const app = express();
  app.use('/boards', boardsRouter);
  
  const routes = boardsRouter.stack
    .filter(layer => layer.route)
    .map(layer => layer.route.path);
    
  assert.ok(routes.includes('/'));
  assert.ok(routes.includes('/:id'));
  assert.ok(routes.includes('/:id/snapshots'));
  assert.ok(routes.includes('/:id/snapshots/:snapshotId/restore'));
});
