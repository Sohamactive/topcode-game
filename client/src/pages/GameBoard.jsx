import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import '../styles/GameBoard.css'

const BOARD_SIZE = 25

function normalizePosition(position) {
  const parsed = Number(position)
  if (!Number.isFinite(parsed)) return 0
  return ((parsed % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
}

function buildPositionMap(teams = []) {
  return teams.reduce((accumulator, team) => {
    accumulator[team.id] = normalizePosition(team.position)
    return accumulator
  }, {})
}

function buildBoardSpaces(spaces = []) {
  const byId = new Map(
    spaces
      .map((space) => {
        const parsedId = Number(space?.id)
        const normalizedId = Number.isFinite(parsedId)
          ? parsedId
          : Number.isFinite(Number(space?.number))
          ? Number(space.number) - 1
          : null

        if (normalizedId === null) return null
        return [normalizedId, space]
      })
      .filter(Boolean)
  )

  return Array.from({ length: BOARD_SIZE }, (_, idx) => {
    const source = byId.get(idx)
    return {
      id: idx,
      number: Number.isFinite(Number(source?.number)) ? Number(source.number) : idx + 1,
      prompt: source?.prompt || null
    }
  })
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

export default function GameBoard({
  gameState: initialGameState,
  isHost,
  selectedTeamId,
  participantName,
  participantUserId,
  isCaptain
}) {
  const [gameState, setGameState] = useState(initialGameState)
  const [error, setError] = useState(null)
  const [showQR, setShowQR] = useState(true)
  const [isRolling, setIsRolling] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  const [displayPositions, setDisplayPositions] = useState(buildPositionMap(initialGameState?.teams || []))
  const [isTokenAnimating, setIsTokenAnimating] = useState(false)
  const [activeJump, setActiveJump] = useState({ teamId: null, spaceId: null })

  const [isDiceOverlayVisible, setIsDiceOverlayVisible] = useState(false)
  const [diceOverlayValue, setDiceOverlayValue] = useState(1)
  const [latestRoll, setLatestRoll] = useState(
    Number.isFinite(Number(initialGameState?.last_roll)) ? Number(initialGameState.last_roll) : null
  )

  useEffect(() => {
    if (!gameState?.id) return undefined

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const wsUrl = `${protocol}//${host}:3000/api/games/${gameState.id}/ws`

    let pollInterval = null

    const startPolling = () => {
      if (!pollInterval) {
        pollInterval = setInterval(async () => {
          try {
            const response = await axios.get(`/api/games/${gameState.id}`)
            setGameState(response.data)
          } catch (pollError) {
            console.error('Polling error:', pollError)
          }
        }, 2000)
      }
    }

    try {
      const websocket = new WebSocket(wsUrl)
      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'game_state') {
          setGameState(data.game)
        }
      }
      websocket.onerror = () => startPolling()
      websocket.onclose = () => startPolling()

      return () => {
        websocket.close()
        if (pollInterval) clearInterval(pollInterval)
      }
    } catch (websocketError) {
      console.error('WebSocket failed, fallback polling:', websocketError)
      startPolling()

      return () => {
        if (pollInterval) clearInterval(pollInterval)
      }
    }
  }, [gameState?.id])

  useEffect(() => {
    if (!isTokenAnimating) {
      setDisplayPositions(buildPositionMap(gameState?.teams || []))
    }
  }, [gameState?.teams, isTokenAnimating])

  useEffect(() => {
    const roll = Number(gameState?.last_roll)
    if (Number.isFinite(roll)) {
      setLatestRoll(roll)
    }
  }, [gameState?.last_roll])

  const currentTeam = gameState?.teams?.[gameState.current_team_index]
  const nextTeam = gameState?.teams?.length
    ? gameState.teams[(gameState.current_team_index + 1) % gameState.teams.length]
    : null

  const myTeam = useMemo(
    () => gameState?.teams?.find((team) => team.id === selectedTeamId),
    [gameState, selectedTeamId]
  )
  const boardSpaces = useMemo(() => buildBoardSpaces(gameState?.boardSpaces || []), [gameState?.boardSpaces])

  const canCaptainRoll = Boolean(
    !isHost &&
      isCaptain &&
      myTeam?.id &&
      currentTeam?.id &&
      myTeam.id === currentTeam.id &&
      gameState?.status === 'active' &&
      !gameState?.awaiting_resolution
  )

  const canCaptainComplete = Boolean(
    !isHost &&
      isCaptain &&
      myTeam?.id &&
      currentTeam?.id &&
      myTeam.id === currentTeam.id &&
      gameState?.status === 'active' &&
      gameState?.awaiting_resolution &&
      gameState?.current_prompt
  )

  const runDiceSimulation = async (finalRoll) => {
    setIsDiceOverlayVisible(true)
    setDiceOverlayValue(Math.floor(Math.random() * 6) + 1)

    let elapsed = 0
    const interval = setInterval(() => {
      setDiceOverlayValue(Math.floor(Math.random() * 6) + 1)
      elapsed += 90
    }, 90)

    await sleep(720)
    clearInterval(interval)

    setDiceOverlayValue(finalRoll)
    await sleep(520)
    setIsDiceOverlayVisible(false)
  }

  const runTokenAnimation = async (teamId, startPosition, rollValue) => {
    if (!teamId || !Number.isFinite(rollValue) || rollValue <= 0) return

    setIsTokenAnimating(true)

    for (let step = 1; step <= rollValue; step += 1) {
      const nextPosition = (startPosition + step) % BOARD_SIZE

      setDisplayPositions((previous) => ({
        ...previous,
        [teamId]: nextPosition
      }))

      setActiveJump({ teamId, spaceId: nextPosition })
      await sleep(220)
    }

    setActiveJump({ teamId: null, spaceId: null })
    setIsTokenAnimating(false)
  }

  const handleCaptainRoll = async () => {
    if (!participantUserId) {
      setError('Missing participant identity. Please rejoin the game.')
      return
    }

    if (!currentTeam?.id) {
      setError('Current team is unavailable. Please refresh and try again.')
      return
    }

    try {
      setIsRolling(true)
      setError(null)

      const rollingTeamId = currentTeam.id
      const startPosition =
        displayPositions[rollingTeamId] !== undefined
          ? displayPositions[rollingTeamId]
          : normalizePosition(currentTeam.position)

      const response = await axios.post(`/api/admin/games/${gameState.id}/roll`, {
        user_id: participantUserId
      })

      const nextGame = response.data?.game
      const rolledValue = Number(response.data?.roll)

      if (nextGame) {
        setGameState(nextGame)
      }

      if (Number.isFinite(rolledValue)) {
        setLatestRoll(rolledValue)
        await runDiceSimulation(rolledValue)
        await runTokenAnimation(rollingTeamId, startPosition, rolledValue)
      }

      if (nextGame?.teams) {
        setDisplayPositions(buildPositionMap(nextGame.teams))
      }
    } catch (rollError) {
      setError(rollError.response?.data?.error || 'Failed to roll dice')
    } finally {
      setIsRolling(false)
      setIsTokenAnimating(false)
      setActiveJump({ teamId: null, spaceId: null })
      setIsDiceOverlayVisible(false)
    }
  }

  const handleCaptainDone = async () => {
    if (!participantUserId) {
      setError('Missing participant identity. Please rejoin the game.')
      return
    }

    try {
      setIsCompleting(true)
      setError(null)

      const response = await axios.post(`/api/admin/games/${gameState.id}/resolve`, {
        completed: true,
        user_id: participantUserId
      })

      setGameState(response.data.game)
    } catch (resolveError) {
      setError(resolveError.response?.data?.error || 'Failed to complete prompt')
    } finally {
      setIsCompleting(false)
    }
  }

  const renderBoard = () => {
    if (!boardSpaces.length) return <div>Board not initialized</div>

    return (
      <div className="board-grid-container">
        <div className="board-grid-5x5">
          {boardSpaces.map((space) => {
            const isLastAssigned = gameState.last_assigned_space?.id === space.id
            const isPromptFlipped = Boolean(
              isLastAssigned &&
                gameState.current_prompt &&
                (gameState.awaiting_resolution || gameState.status === 'active')
            )

            const teamsOnSpace =
              gameState.teams?.filter((team) => {
                const shownPosition =
                  displayPositions[team.id] !== undefined
                    ? displayPositions[team.id]
                    : normalizePosition(team.position)
                return shownPosition === space.id
              }) || []

            const promptLabel = space.prompt?.type || (space.number === 1 ? 'Prompt 1' : null)

            return (
              <div
                key={space.id}
                className={`board-space-5x5 ${isLastAssigned ? 'current-space' : ''} ${isPromptFlipped ? 'is-flipped' : ''}`}
              >
                <div className="space-flip-inner">
                  <div className="space-face space-front">
                    <div className="space-number-5x5">#{space.number}</div>

                    {promptLabel ? (
                      <div className="space-prompt-preview" title={space.prompt?.text || promptLabel}>
                        {promptLabel}
                      </div>
                    ) : null}

                    {teamsOnSpace.length > 0 ? (
                      <div className="space-tokens">
                        {teamsOnSpace.map((team, index) => {
                          const hue = (index * 120) % 360
                          const isJumpingToken = activeJump.teamId === team.id && activeJump.spaceId === space.id

                          return (
                            <div
                              key={team.id}
                              className={`team-token ${isJumpingToken ? 'jumping' : ''}`}
                              style={{ background: `hsl(${hue}, 70%, 45%)` }}
                              title={team.name}
                            >
                              {team.name.substring(0, 1)}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-face space-back">
                    <div className="space-back-type">{space.prompt?.type || 'Prompt'}</div>
                    <p className="space-back-text">{space.prompt?.text || gameState.current_prompt?.text || 'No prompt assigned'}</p>
                  </div>
                </div>

                {isLastAssigned ? <div className="current-space-marker">o</div> : null}
              </div>
            )
          })}
        </div>

        {isDiceOverlayVisible ? (
          <div className="dice-animation-overlay">
            <div className="dice-roller">
              <div className="dice-overlay-number">{diceOverlayValue}</div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="game-board">
      <div className="session-layout">
        <header className="top-bar">
          <h1 className="session-title">Momentum Live Match</h1>
          <div className="top-bar-meta">
            <span className="meta-chip">Session: {gameState.session_code || '------'}</span>
            <span className="meta-chip">Status: {gameState.status || 'pending'}</span>
            <span className="meta-chip">Turn: {Number.isFinite(gameState?.current_team_index) ? gameState.current_team_index + 1 : '-'}</span>
          </div>
        </header>

        <div className="main-content-row">
          <aside className="left-panel">
            <div className="panel-card">
              <p className="label-text">Current Team</p>
              <p className="primary-team-name">{currentTeam?.name || 'Waiting...'}</p>
            </div>

            <div className="panel-card">
              <p className="label-text">Next Team</p>
              <p className="secondary-team-name">{nextTeam?.name || 'TBD'}</p>
            </div>

            <div className="panel-card">
              <p className="label-text">Teams</p>
              <div className="compact-team-list">
                {gameState.teams?.map((team) => (
                  <div key={team.id} className={`compact-team-item ${team.id === currentTeam?.id ? 'active' : ''}`}>
                    <span>{team.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-card">
              <p className="label-text">Session Note</p>
              <p className="status-copy">
                {gameState.awaiting_resolution
                  ? 'Challenge is active. Waiting for completion.'
                  : 'Waiting for active team to roll.'}
              </p>
            </div>

            {!isHost ? (
              <div className="panel-card">
                <p className="label-text">Viewer</p>
                <p className="status-copy">
                  {myTeam
                    ? `${participantName || 'You'} in ${myTeam.name}${isCaptain ? ' (Captain)' : ''}`
                    : 'Participant mode'}
                </p>
              </div>
            ) : null}
          </aside>

          <section className="board-panel">
            <div className="board-meta">
              <div className="meta-stat">Latest Roll: <strong>{Number.isFinite(latestRoll) ? latestRoll : '-'}</strong></div>
              {gameState.last_assigned_space ? (
                <div className="meta-stat">Landed: <strong>#{gameState.last_assigned_space.number}</strong></div>
              ) : null}
            </div>
            {renderBoard()}
          </section>

          <aside className="right-panel">
            <div className="panel-card prompt-side-panel">
              <p className="label-text">Current Prompt</p>
              {gameState.current_prompt ? (
                <div className="prompt-card active">
                  <div className={`prompt-type ${gameState.current_prompt.type.toLowerCase()}`}>{gameState.current_prompt.type}</div>
                  <p className="prompt-text">{gameState.current_prompt.text}</p>
                  <div className="prompt-timer">
                    {gameState.awaiting_resolution ? 'Awaiting challenge completion...' : 'Challenge resolved, waiting for next team...'}
                  </div>
                </div>
              ) : (
                <div className="prompt-card empty">
                  <p>{gameState.status === 'pending' ? 'Waiting for host to start the game...' : 'Waiting for next challenge...'}</p>
                </div>
              )}
            </div>

            {isHost ? (
              <div className="panel-card control-stack">
                <p className="label-text">Host Controls</p>
                <button className="brutal-button primary" type="button" disabled>
                  Roll Dice
                </button>
                <button className="brutal-button" type="button" disabled>
                  Next Team
                </button>
                <button className="brutal-button danger" type="button" disabled>
                  End Session
                </button>
                <p className="status-copy">Host actions are managed from the Host Dashboard session token flow.</p>
              </div>
            ) : null}

            {!isHost && myTeam && !isCaptain ? (
              <div className="panel-card">
                <p className="label-text">Team Actions</p>
                <p className="status-copy">Only the current team captain can roll dice.</p>
              </div>
            ) : null}

            {canCaptainRoll ? (
              <div className="panel-card control-stack">
                <p className="label-text">Captain Action</p>
                <button
                  className="brutal-button primary"
                  onClick={handleCaptainRoll}
                  disabled={isRolling || isTokenAnimating}
                >
                  {isRolling ? 'Rolling...' : 'Roll Dice'}
                </button>
              </div>
            ) : null}

            {canCaptainComplete ? (
              <div className="panel-card control-stack">
                <p className="label-text">Challenge</p>
                <button className="brutal-button success" onClick={handleCaptainDone} disabled={isCompleting}>
                  {isCompleting ? 'Saving...' : 'Done'}
                </button>
              </div>
            ) : null}

            {isHost && showQR && gameState.qr_code ? (
              <div className="panel-card qr-mini">
                <p className="label-text">Join</p>
                <img src={gameState.qr_code} alt="Join QR Code" className="qr-code" />
                <button className="brutal-button" type="button" onClick={() => setShowQR(false)}>
                  Hide QR
                </button>
              </div>
            ) : null}
          </aside>
        </div>

        {error ? <div className="error">{error}</div> : null}
      </div>
    </div>
  )
}
