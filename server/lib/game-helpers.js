export function generateSessionCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function initializeBoardSpaces(size = 25, columns = 5) {
  const spaces = [];
  for (let i = 0; i < size; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    spaces.push({
      id: i,
      number: i + 1,
      row,
      col,
      prompt_id: null,
      prompt: null
    });
  }
  return spaces;
}

export function assignPromptsToSpaces(boardSpaces, shuffledPrompts) {
  if (!Array.isArray(boardSpaces) || !Array.isArray(shuffledPrompts) || shuffledPrompts.length === 0) {
    return boardSpaces;
  }

  const promptCount = shuffledPrompts.length;
  for (let i = 0; i < boardSpaces.length; i++) {
    const prompt = shuffledPrompts[i % promptCount];
    boardSpaces[i].prompt_id = prompt.id;
    boardSpaces[i].prompt = prompt;
  }

  return boardSpaces;
}

export function getUnvisitedSpaces(team, boardSpaces) {
  const visitedIds = new Set(team?.visitedSpaceIds || []);
  return boardSpaces.filter((space) => !visitedIds.has(space.id));
}

export function getHostSessionToken(req) {
  const headerToken = req?.headers?.['x-host-session'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  if (typeof req?.body?.hostSessionToken === 'string' && req.body.hostSessionToken.trim()) {
    return req.body.hostSessionToken.trim();
  }

  return null;
}

export function getRequestUserId(req) {
  const bodyId = req?.body?.user_id;
  const headerId = req?.headers?.['x-user-id'];

  if (typeof bodyId === 'string' && bodyId.trim()) return bodyId.trim();
  if (typeof headerId === 'string' && headerId.trim()) return headerId.trim();

  return null;
}

export function isCurrentTeamCaptain(req, game) {
  const currentTeam = game?.teams?.[game?.current_team_index];
  const userId = getRequestUserId(req);
  return Boolean(currentTeam?.captain_id && userId && currentTeam.captain_id === userId);
}