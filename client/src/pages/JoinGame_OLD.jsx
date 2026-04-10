import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import '../styles/JoinGame.css'

export default function JoinGame({ gameId, onJoinGame, onBack }) {
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [joinMode, setJoinMode] = useState('watch')
  const [gameData, setGameData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided')
      setIsLoading(false)
      return
    }

    const fetchGame = async () => {
      try {
        console.log('Fetching game:', gameId)
        const response = await axios.get(`/api/games/${gameId}`)
        console.log('Game data loaded:', response.data)
        setGameData(response.data)
      } catch (err) {
        setError('Failed to load game. Session may have expired or does not exist.')
        console.error('Error fetching game:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGame()
  }, [gameId])

  const handleJoin = async () => {
    if (joinMode === 'team' && !selectedTeam) return
    
    setIsJoining(true)
    try {
      const playerId = uuidv4()
      onJoinGame(gameData, {
        playerId,
        mode: joinMode,
        teamId: joinMode === 'team' ? selectedTeam.id : null
      })
    } catch (err) {
      setError('Failed to join game')
      console.error('Error joining game:', err)
    } finally {
      setIsJoining(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">
          <span className="spinner"></span>
          <span>Loading game...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <h1 className="title">Game Not Found</h1>
          <p className="error">{error}</p>
          <button className="button" onClick={onBack}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card join-card">
        <h1 className="title">Join Game</h1>
        <p className="subtitle">
          Code: <strong>{gameData?.session_code}</strong> - Join a team or watch live
        </p>

        <div className="join-mode-toggle">
          <button
            className={`mode-button ${joinMode === 'watch' ? 'selected' : ''}`}
            onClick={() => {
              setJoinMode('watch')
              setSelectedTeam(null)
            }}
            disabled={isJoining}
          >
            👀 Watch
          </button>
          <button
            className={`mode-button ${joinMode === 'team' ? 'selected' : ''}`}
            onClick={() => setJoinMode('team')}
            disabled={isJoining}
          >
            👥 Join Team
          </button>
        </div>

        {joinMode === 'team' && (
          <div className="team-selection">
            {gameData?.teams?.map((team) => (
              <button
                key={team.id}
                className={`team-button ${selectedTeam?.id === team.id ? 'selected' : ''}`}
                onClick={() => setSelectedTeam(team)}
                disabled={isJoining}
              >
                {team.name}
              </button>
            ))}
          </div>
        )}

        <div className="join-actions">
          <button
            className="button"
            onClick={handleJoin}
            disabled={isJoining || (joinMode === 'team' && !selectedTeam)}
            style={{ width: '100%' }}
          >
            {isJoining
              ? '⏳ Joining...'
              : joinMode === 'watch'
              ? '✅ Enter as Watcher'
              : `✅ Join ${selectedTeam?.name || 'Team'}`}
          </button>
          {joinMode === 'team' && selectedTeam && (
            <button
              className="button button-secondary"
              onClick={() => setSelectedTeam(null)}
              disabled={isJoining}
              style={{ width: '100%' }}
            >
              Change Team
            </button>
          )}
        </div>

        <button
          className="button button-secondary"
          onClick={onBack}
          disabled={isJoining}
          style={{ width: '100%', marginTop: '20px' }}
        >
          Back
        </button>
      </div>
    </div>
  )
}
