import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignPromptsToSpaces,
  generateSessionCode,
  getHostSessionToken,
  getRequestUserId,
  getUnvisitedSpaces,
  initializeBoardSpaces,
  isCurrentTeamCaptain
} from '../lib/game-helpers.js';

test('generateSessionCode returns an uppercase alphanumeric code', () => {
  const code = generateSessionCode();

  assert.match(code, /^[A-Z0-9]{6}$/);
});

test('initializeBoardSpaces creates a 5x5 board with stable coordinates', () => {
  const spaces = initializeBoardSpaces();

  assert.equal(spaces.length, 25);
  assert.deepEqual(spaces[0], {
    id: 0,
    number: 1,
    row: 0,
    col: 0,
    prompt_id: null,
    prompt: null
  });
  assert.deepEqual(spaces[24], {
    id: 24,
    number: 25,
    row: 4,
    col: 4,
    prompt_id: null,
    prompt: null
  });
});

test('assignPromptsToSpaces loops prompts across the board', () => {
  const spaces = initializeBoardSpaces(4, 2);
  const prompts = [
    { id: 'p1', text: 'First prompt' },
    { id: 'p2', text: 'Second prompt' }
  ];

  assignPromptsToSpaces(spaces, prompts);

  assert.deepEqual(
    spaces.map((space) => space.prompt_id),
    ['p1', 'p2', 'p1', 'p2']
  );
});

test('getUnvisitedSpaces filters out visited space ids', () => {
  const spaces = initializeBoardSpaces(5, 5);

  const remaining = getUnvisitedSpaces({ visitedSpaceIds: [1, 3] }, spaces);

  assert.deepEqual(
    remaining.map((space) => space.id),
    [0, 2, 4]
  );
});

test('request helpers read tokens and user ids from headers or body', () => {
  assert.equal(getHostSessionToken({ headers: { 'x-host-session': ' host-123 ' } }), 'host-123');
  assert.equal(getHostSessionToken({ body: { hostSessionToken: ' body-123 ' } }), 'body-123');
  assert.equal(getRequestUserId({ headers: { 'x-user-id': ' user-1 ' } }), 'user-1');
  assert.equal(getRequestUserId({ body: { user_id: ' body-user ' } }), 'body-user');
});

test('isCurrentTeamCaptain only passes for the active team captain', () => {
  const game = {
    current_team_index: 0,
    teams: [{ captain_id: 'captain-1' }, { captain_id: 'captain-2' }]
  };

  assert.equal(isCurrentTeamCaptain({ body: { user_id: 'captain-1' } }, game), true);
  assert.equal(isCurrentTeamCaptain({ headers: { 'x-user-id': 'captain-2' } }, game), false);
});