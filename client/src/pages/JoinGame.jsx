import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { v4 as uuidv4 } from 'uuid'
import '../styles/JoinGame.css'

const STEP_QR = 'qr'
const STEP_NAME = 'name'
const STEP_TEAM = 'team'
const STEP_CAPTAIN = 'captain'
const STEP_JOINING = 'joining'
const BOARD_SIZE = 25

function normalizeBoardSpaces(boardSpaces = []) {
  const byId = new Map(
    boardSpaces
      .map((space) => {
        const parsedId = Number(space?.id)
        if (Number.isFinite(parsedId)) return [parsedId, space]

        const parsedNumber = Number(space?.number)
        if (Number.isFinite(parsedNumber)) return [parsedNumber - 1, space]
        return null
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

export default function JoinGame({ gameId: initialGameId, onJoinGame, onBack }) {
  const [step, setStep] = useState(STEP_QR)
  const [scannedGameId, setScannedGameId] = useState(initialGameId || null)
  const [participantName, setParticipantName] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [wantsCaptain, setWantsCaptain] = useState(false)
  const [userId] = useState(uuidv4())

  const [gameData, setGameData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualGameCode, setManualGameCode] = useState('')
  const qrScannerRef = useRef(null)
  const qrContainerRef = useRef(null)

  const previewSpaces = useMemo(() => normalizeBoardSpaces(gameData?.boardSpaces || []), [gameData?.boardSpaces])

  const resetToQrStep = () => {
    setStep(STEP_QR)
    setScannedGameId(null)
    setGameData(null)
    setParticipantName('')
    setSelectedTeamId(null)
    setWantsCaptain(false)
    setError('')
    setMessage('')
  }

  useEffect(() => {
    if (!scannedGameId) return

    const fetchGame = async () => {
      try {
        setIsLoading(true)
        setError('')

        const response = await axios.get(`/api/games/${scannedGameId}`)
        setGameData(response.data)
        setStep(STEP_NAME)
      } catch (err) {
        setError('Failed to load game. Invalid game ID or game not found.')
        console.error('Error fetching game:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGame()
  }, [scannedGameId])

  useEffect(() => {
    if (step !== STEP_QR || !qrContainerRef.current || scannedGameId) return

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 220, height: 220 }
      },
      false
    )

    scanner.render(
      (decodedText) => {
        try {
          const url = new URL(decodedText)
          const pathParts = url.pathname.split('/').filter(Boolean)
          const gameId = pathParts[pathParts.length - 1]
          if (gameId) {
            scanner.clear()
            setScannedGameId(gameId)
            setShowManualEntry(false)
            setError('')
          }
        } catch (scanError) {
          if (decodedText && decodedText.trim()) {
            scanner.clear()
            setScannedGameId(decodedText.trim().toUpperCase())
            setShowManualEntry(false)
            setError('')
          }
          console.warn('QR parse fallback used:', scanError)
        }
      },
      () => {
        // Keep scanner quiet in UI; errors are expected while no code is visible.
      }
    )

    qrScannerRef.current = scanner

    return () => {
      scanner.clear().catch((cleanupError) => {
        console.warn('Scanner cleanup error:', cleanupError)
      })
    }
  }, [step, scannedGameId])

  const handleManualCodeSubmit = () => {
    const normalizedCode = manualGameCode.trim().toUpperCase()
    if (!normalizedCode) {
      setError('Please enter a game code')
      return
    }

    setError('')
    setShowManualEntry(false)
    setManualGameCode('')
    setScannedGameId(normalizedCode)
  }

  const handleNameSubmit = () => {
    if (!participantName.trim()) {
      setError('Please enter your name')
      return
    }
    setError('')
    setStep(STEP_TEAM)
  }

  const handleTeamSelect = (teamId) => {
    setSelectedTeamId(teamId)
    setStep(STEP_CAPTAIN)
  }

  const handleCaptainDecision = async () => {
    if (!selectedTeamId || !participantName.trim()) {
      setError('Missing required information')
      return
    }

    setIsJoining(true)
    setError('')

    try {
      const response = await axios.post(`/api/admin/games/${scannedGameId}/join-team`, {
        teamId: selectedTeamId,
        userId,
        name: participantName.trim(),
        isCaptain: wantsCaptain
      })

      setStep(STEP_JOINING)
      setMessage(`Welcome to ${response.data.team.name}.`)

      setTimeout(() => {
        onJoinGame(gameData, {
          userId,
          participantName: participantName.trim(),
          teamId: selectedTeamId,
          isCaptain: wantsCaptain,
          team: response.data.team
        })
      }, 500)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join team')
      setIsJoining(false)
      console.error('Error joining team:', err)
    }
  }

  const renderBoardPreview = () => {
    if (!gameData) return null

    return (
      <section className="join-board-preview">
        <h3>5x5 Board Preview</h3>
        <div className="join-board-grid-5x5">
          {previewSpaces.map((space) => {
            const promptLabel = space.prompt?.type || `Prompt ${space.number}`
            const promptTitle = space.prompt?.text || `Prompt ${space.number}`

            return (
              <div key={space.id} className="join-board-space">
                <div className="join-space-number">#{space.number}</div>
                <div className={`join-space-prompt ${space.prompt ? '' : 'placeholder'}`} title={promptTitle}>
                  {promptLabel}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  const renderStepLayout = (content, onBackAction) => (
    <div className="container join-container">
      {onBackAction ? (
        <button className="back-button" onClick={onBackAction}>
          Back
        </button>
      ) : null}
      <div className="join-wrapper">
        {content}
        {renderBoardPreview()}
      </div>
    </div>
  )

  if (step === STEP_QR) {
    return (
      <div className="container join-container">
        <button className="back-button" onClick={onBack}>
          Back
        </button>

        <div className="join-card">
          {!showManualEntry ? (
            <>
              <h1 className="title">Join Game</h1>
              <p className="subtitle">Scan the QR code to join</p>

              {error && <div className="error-banner">{error}</div>}

              <div id="qr-reader" ref={qrContainerRef} className="qr-reader-container"></div>

              <div className="or-divider">OR</div>

              <button className="button button-secondary join-full-width" onClick={() => setShowManualEntry(true)}>
                Enter Code Manually
              </button>
            </>
          ) : (
            <>
              <h1 className="title">Enter Game Code</h1>
              <p className="subtitle">Use the 6-character code from the host</p>

              {error && <div className="error-banner">{error}</div>}

              <input
                type="text"
                className="input"
                placeholder="e.g. ABC123"
                value={manualGameCode}
                onChange={(event) => setManualGameCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === 'Enter' && handleManualCodeSubmit()}
                maxLength="6"
              />

              <button className="button join-full-width" onClick={handleManualCodeSubmit}>
                Next
              </button>

              <button
                className="button button-secondary join-full-width"
                onClick={() => {
                  setShowManualEntry(false)
                  setManualGameCode('')
                  setError('')
                }}
              >
                Back to QR
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return renderStepLayout(
      <div className="join-card">
        <h1 className="title">Loading Game</h1>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (step === STEP_NAME && gameData) {
    return renderStepLayout(
      <div className="join-card">
        <h1 className="title">Welcome</h1>
        <p className="subtitle">
          Game Code: <strong>{gameData.session_code}</strong>
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div className="form-group">
          <label htmlFor="participant-name">What is your name?</label>
          <input
            id="participant-name"
            type="text"
            className="input"
            placeholder="Enter your name"
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleNameSubmit()}
            autoFocus
          />
        </div>

        <button className="button join-full-width" onClick={handleNameSubmit}>
          Continue
        </button>
      </div>,
      resetToQrStep
    )
  }

  if (step === STEP_TEAM && gameData) {
    return renderStepLayout(
      <div className="join-card">
        <h1 className="title">Select Your Team</h1>
        <p className="subtitle">
          Hi <strong>{participantName}</strong>, choose one team.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div className="team-grid">
          {gameData.teams?.map((team) => (
            <button
              key={team.id}
              className={`team-card ${selectedTeamId === team.id ? 'selected' : ''}`}
              onClick={() => handleTeamSelect(team.id)}
            >
              <div className="team-name">{team.name}</div>
              <div className="team-members">
                {team.members?.length || 0} member{(team.members?.length || 0) === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
      </div>,
      () => setStep(STEP_NAME)
    )
  }

  if (step === STEP_CAPTAIN && gameData) {
    const selectedTeam = gameData.teams?.find((team) => team.id === selectedTeamId)
    const hasCaptain = Boolean(selectedTeam?.captain_id)

    return renderStepLayout(
      <div className="join-card">
        <h1 className="title">Choose Role</h1>
        <p className="subtitle">
          Team: <strong>{selectedTeam?.name}</strong>
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div className="captain-options">
          <button
            className={`option-card ${wantsCaptain ? 'selected' : ''}`}
            onClick={() => setWantsCaptain(true)}
            disabled={hasCaptain && !wantsCaptain}
          >
            <div className="option-icon">Roll</div>
            <div className="option-title">Captain</div>
            <div className="option-desc">
              {hasCaptain ? 'Captain already assigned for this team.' : 'Captain can roll dice for the team.'}
            </div>
          </button>

          <button className={`option-card ${!wantsCaptain ? 'selected' : ''}`} onClick={() => setWantsCaptain(false)}>
            <div className="option-icon">Play</div>
            <div className="option-title">Team Member</div>
            <div className="option-desc">Join and participate with your team.</div>
          </button>
        </div>

        <button
          className="button join-full-width"
          onClick={handleCaptainDecision}
          disabled={isJoining || (wantsCaptain && hasCaptain)}
        >
          {isJoining ? 'Joining...' : 'Confirm and Join'}
        </button>
      </div>,
      () => setStep(STEP_TEAM)
    )
  }

  if (step === STEP_JOINING) {
    return renderStepLayout(
      <div className="join-card">
        <h1 className="title">Joining</h1>
        <p className="subtitle">{message || 'Please wait while we connect you.'}</p>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="container join-container">
      <div className="join-card">
        <h1 className="title">Something went wrong</h1>
        <button className="button join-full-width" onClick={onBack}>
          Go Home
        </button>
      </div>
    </div>
  )
}
