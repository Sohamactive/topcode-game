# Board Design

## Current Board Model
- Total spaces: 25.
- Layout: 5 rows x 5 columns.
- Each space stores `id`, `number`, `row`, `col`, `prompt_id`, and `prompt`.
- Team positions wrap around the board when they pass space 25.

## How It Works
1. The server creates 25 spaces at game creation.
2. At game start, enabled prompts are shuffled and assigned across the board.
3. A captain rolls 1-6.
4. The current team advances by that amount.
5. The team lands on a numbered space and sees that space's prompt.
6. The host resolves the prompt and keeps the turn on the active team until resolution.

## Prompt Behavior
- Prompts come from the board space the team lands on.
- The current UI shows the prompt type and prompt text from that space.
- Hidden prompts are excluded before board assignment.
- New prompts added during a game are available after the prompt pool refreshes.

## UI Representation
- Current space: highlighted in the host and player views.
- Latest roll: shown separately from the board.
- Active prompt: shown as a large card in the live game view.
- Team tokens: shown on the board using their current positions.

## Why This Structure
- It is easier for a room to read than a long race-track layout.
- It keeps the game non-competitive while still giving movement and progression.
- It works well on a projection screen and on mobile devices.
