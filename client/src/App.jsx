import React, { useState, useEffect } from 'react'
import HostDashboard from './pages/HostDashboard'
import JoinGame from './pages/JoinGame'
import GameBoard from './pages/GameBoard'
import './styles/App.css'

export default function App() {
  const [page, setPage] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [participantName, setParticipantName] = useState('')
  const [participantUserId, setParticipantUserId] = useState('')
  const [isCaptain, setIsCaptain] = useState(false)
  const [isHost, setIsHost] = useState(false)

  useEffect(() => {
    // Determine initial page based on URL
    const path = window.location.pathname
    if (path === '/') {
      setPage('host-dashboard')
    } else if (path.startsWith('/game/')) {
      // Host view (already has gameId in memory)
      const gameId = path.split('/')[2]
      setGameState({ id: gameId })
      setIsHost(true)
      setPage('game-board')
    } else if (path.startsWith('/join/')) {
      // Participant join view
      const gameId = path.split('/')[2]
      setPage('join-game')
      setGameState({ id: gameId })
    } else {
      setPage('host-dashboard')
    }
  }, [])

  const handleJoinGame = (gameData, joinPayload) => {
    setGameState(gameData)
    setParticipantName(joinPayload?.participantName || '')
    setParticipantUserId(joinPayload?.userId || '')
    setIsCaptain(Boolean(joinPayload?.isCaptain))
    setSelectedTeamId(joinPayload?.teamId || null)
    setPage('game-board')
  }

  const handleBack = () => {
    setPage('host-dashboard')
    setGameState(null)
    setParticipantName('')
    setParticipantUserId('')
    setIsCaptain(false)
    setSelectedTeamId(null)
    setIsHost(false)
    window.history.pushState(null, '', '/')
  }

  return (
    <div className="app">
      {page === 'host-dashboard' && (
        <HostDashboard />
      )}
      {page === 'join-game' && (
        <JoinGame gameId={gameState?.id} onJoinGame={handleJoinGame} onBack={handleBack} />
      )}
      {page === 'game-board' && (
        <GameBoard
          gameState={gameState}
          isHost={isHost}
          selectedTeamId={selectedTeamId}
          participantName={participantName}
          participantUserId={participantUserId}
          isCaptain={isCaptain}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
