import React, { useMemo, useState } from 'react'
import axios from 'axios'
import '../styles/HostDashboard.css'

export default function HostDashboard() {
  const [teams, setTeams] = useState(['Team 1', 'Team 2'])
  const [gameState, setGameState] = useState(null)
  const [hostSessionToken, setHostSessionToken] = useState('')
  const [promptList, setPromptList] = useState([])
  const [promptFilterType, setPromptFilterType] = useState('All')
  const [newPrompt, setNewPrompt] = useState({ type: 'Move', text: '' })
  const [editingPromptId, setEditingPromptId] = useState(null)
  const [editingPrompt, setEditingPrompt] = useState({ text: '', type: 'Move', enabled: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const hostHeaders = useMemo(() => ({ 'x-host-session': hostSessionToken }), [hostSessionToken])

  const withHostCall = async (fn) => {
    try {
      setLoading(true)
      setError('')
      setMessage('')
      await fn()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const refreshGame = async (gameId = gameState?.id) => {
    if (!gameId || !hostSessionToken) return
    const response = await axios.get(`/api/admin/games/${gameId}`, { headers: hostHeaders })
    setGameState(response.data)
  }

  const refreshPrompts = async (gameId = gameState?.id) => {
    if (!gameId || !hostSessionToken) return
    const response = await axios.get(`/api/admin/games/${gameId}/prompts`, { headers: hostHeaders })
    setPromptList(response.data)
  }

  const handleCreateGame = async () => {
    await withHostCall(async () => {
      const payload = {
        teams: teams.map((team) => team.trim()).filter(Boolean)
      }
      if (payload.teams.length < 2) throw new Error('At least 2 teams are required')

      const response = await axios.post('/api/admin/games', payload)
      const newGame = response.data.game
      const newToken = response.data.host_session_token

      setHostSessionToken(newToken)
      setGameState(newGame)
      setMessage(`Game created. Session code: ${response.data.session_code}`)
      localStorage.setItem(`hostSessionToken:${newGame.id}`, newToken)

      const promptResponse = await axios.get(`/api/admin/games/${newGame.id}/prompts`, {
        headers: { 'x-host-session': newToken }
      })
      setPromptList(promptResponse.data)
    })
  }

  const handleStartGame = async () => {
    await withHostCall(async () => {
      const response = await axios.post(`/api/admin/games/${gameState.id}/start`, {}, { headers: hostHeaders })
      setGameState(response.data.game)
      setMessage(response.data.message || 'Game started')
    })
  }

  const handleResolve = async (completed) => {
    await withHostCall(async () => {
      const response = await axios.post(
        `/api/admin/games/${gameState.id}/resolve`,
        { completed },
        { headers: hostHeaders }
      )
      setGameState(response.data.game)
      setMessage(response.data.message)
    })
  }

  const handleEndGame = async () => {
    if (!window.confirm('End this game now?')) return
    await withHostCall(async () => {
      const response = await axios.post(`/api/admin/games/${gameState.id}/end`, {}, { headers: hostHeaders })
      setGameState(response.data.game)
      setMessage('Game ended')
    })
  }

  const handleAddPrompt = async () => {
    await withHostCall(async () => {
      if (!newPrompt.text.trim()) throw new Error('Prompt text required')
      const response = await axios.post(
        `/api/admin/games/${gameState.id}/prompts`,
        { type: newPrompt.type, text: newPrompt.text.trim() },
        { headers: hostHeaders }
      )
      setNewPrompt((prev) => ({ ...prev, text: '' }))
      await refreshPrompts(gameState.id)
      await refreshGame(gameState.id)
      setMessage(response.data.message)
    })
  }

  const handleTogglePromptVisibility = async (promptId, visibleInGame) => {
    await withHostCall(async () => {
      const response = await axios.post(
        `/api/admin/games/${gameState.id}/prompts/visibility`,
        { promptId, visible: !visibleInGame },
        { headers: hostHeaders }
      )
      await refreshPrompts(gameState.id)
      await refreshGame(gameState.id)
      setMessage(response.data.message)
    })
  }

  const handleStartEditPrompt = (prompt) => {
    setEditingPromptId(prompt.id)
    setEditingPrompt({
      text: prompt.text || '',
      type: prompt.type || 'Move',
      enabled: Boolean(prompt.enabled)
    })
  }

  const handleCancelEditPrompt = () => {
    setEditingPromptId(null)
    setEditingPrompt({ text: '', type: 'Move', enabled: true })
  }

  const handleSavePromptEdit = async (promptId) => {
    await withHostCall(async () => {
      const payload = {
        text: editingPrompt.text,
        type: editingPrompt.type,
        enabled: editingPrompt.enabled
      }
      const response = await axios.put(
        `/api/admin/games/${gameState.id}/prompts/${promptId}`,
        payload,
        { headers: hostHeaders }
      )
      await refreshPrompts(gameState.id)
      await refreshGame(gameState.id)
      setMessage(response.data.message || 'Prompt updated')
      handleCancelEditPrompt()
    })
  }

  const addTeam = () => setTeams((prev) => [...prev, `Team ${prev.length + 1}`])
  const removeTeam = (idx) => setTeams((prev) => prev.filter((_, index) => index !== idx))
  const updateTeam = (idx, value) => setTeams((prev) => prev.map((team, index) => (index === idx ? value : team)))

  const currentTeam = gameState?.teams?.[gameState.current_team_index]
  const filteredPrompts = useMemo(() => {
    if (promptFilterType === 'All') return promptList
    return promptList.filter((prompt) => prompt.type === promptFilterType)
  }, [promptList, promptFilterType])

  if (!gameState) {
    return (
      <div className="host-controller">
        <div className="host-setup">
          <h1>Host Dashboard</h1>
          <p>Create a game, share the QR code, and run the full session from here.</p>

          <div className="form-group">
            <label>Teams *</label>
            {teams.map((team, idx) => (
              <div key={idx} className="team-input-row">
                <input
                  type="text"
                  value={team}
                  onChange={(e) => updateTeam(idx, e.target.value)}
                  placeholder={`Team ${idx + 1}`}
                />
                <button className="button button-secondary" type="button" onClick={() => removeTeam(idx)} disabled={teams.length <= 2}>
                  Remove
                </button>
              </div>
            ))}
            <button className="button" type="button" onClick={addTeam}>+ Add Team</button>
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button className="button button-primary" onClick={handleCreateGame} disabled={loading || teams.filter(Boolean).length < 2}>
            {loading ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="host-controller">
      <div className="host-panel">
        <div className="host-header">
          <h1>Host Control Center</h1>
          <button
            className="button-disconnect"
            onClick={() => {
              setGameState(null)
              setPromptList([])
              setHostSessionToken('')
            }}
          >
            New Game
          </button>
        </div>

        <div className="game-info">
          <div className="info-card">
            <div className="info-item"><span className="label">Game ID</span><span className="value">{gameState.id.slice(0, 8)}...</span></div>
            <div className="info-item"><span className="label">Session</span><span className="value">{gameState.session_code}</span></div>
            <div className="info-item"><span className="label">Status</span><span className="value">{gameState.status}</span></div>
          </div>
          <div className="host-token">Host session token auto-saved for this game.</div>
          <div className="join-url">Join URL: <strong>{gameState.join_url}</strong></div>
          <div className="qr-wrapper">
            <div className="session-code-pill">{gameState.session_code}</div>
            {gameState.qr_code ? <img src={gameState.qr_code} alt="Join QR" className="host-qr" /> : null}
          </div>
        </div>

        <div className="current-team-section">
          <h2>Current Team</h2>
          <div className="team-display">
            <div className="team-name">{currentTeam?.name || 'N/A'}</div>
            <div className="team-position">Visited spaces: {(currentTeam?.visitedSpaceIds || []).length}</div>
          </div>
        </div>

        <div className="prompt-section">
          <h3>Live Challenge</h3>
          {gameState.current_prompt ? (
            <div className="prompt-card">
              <div className={`prompt-type ${gameState.current_prompt.type.toLowerCase()}`}>{gameState.current_prompt.type}</div>
              <p className="prompt-text">{gameState.current_prompt.text}</p>
              {gameState.awaiting_resolution && (
                <div className="controls">
                  <button className="button button-success" onClick={() => handleResolve(true)} disabled={loading}>Completed</button>
                  <button className="button" onClick={() => handleResolve(false)} disabled={loading}>Not Completed</button>
                </div>
              )}
            </div>
          ) : (
            <div className="prompt-card empty">No active challenge</div>
          )}
        </div>

        <div className="controls">
          <button className="button roll-button" onClick={handleStartGame} disabled={loading || gameState.status !== 'pending'}>Start Game</button>
          <button className="button button-danger" onClick={handleEndGame} disabled={loading}>End Game</button>
        </div>

        <div className="prompt-section">
          <h3>Prompt Control (Live)</h3>
          <div className="prompt-toolbar">
            <input
              type="text"
              placeholder="Add a prompt while game is running"
              value={newPrompt.text}
              onChange={(e) => setNewPrompt({ ...newPrompt, text: e.target.value })}
            />
            <select value={newPrompt.type} onChange={(e) => setNewPrompt({ ...newPrompt, type: e.target.value })}>
              <option>Move</option>
              <option>Talk</option>
              <option>Create</option>
              <option>Wildcard</option>
            </select>
            <button className="button button-success" onClick={handleAddPrompt} disabled={loading}>Add</button>
          </div>
          <button className="button button-secondary" onClick={() => withHostCall(async () => { await refreshPrompts(gameState.id); await refreshGame(gameState.id); setMessage('Game state refreshed') })} disabled={loading}>Refresh</button>

          <div className="prompt-filter-row">
            {['All', 'Move', 'Talk', 'Create', 'Wildcard'].map((type) => (
              <button
                key={type}
                className={`button prompt-filter-btn ${promptFilterType === type ? 'active' : ''}`}
                onClick={() => setPromptFilterType(type)}
                disabled={loading}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="teams-list" style={{ marginTop: '12px', maxHeight: '260px', overflowY: 'auto' }}>
            {filteredPrompts.map((prompt) => (
              <div className="team-item" key={prompt.id}>
                <div className="team-info">
                  <div className="team-title">[{prompt.type}] {prompt.text}</div>
                  <div className="team-score">{prompt.visible_in_game ? 'Visible in game' : 'Hidden in game'}</div>
                  {editingPromptId === prompt.id ? (
                    <div className="prompt-edit-box">
                      <input
                        type="text"
                        value={editingPrompt.text}
                        onChange={(e) => setEditingPrompt((prev) => ({ ...prev, text: e.target.value }))}
                        placeholder="Prompt text"
                      />
                      <select
                        value={editingPrompt.type}
                        onChange={(e) => setEditingPrompt((prev) => ({ ...prev, type: e.target.value }))}
                      >
                        <option>Move</option>
                        <option>Talk</option>
                        <option>Create</option>
                        <option>Wildcard</option>
                      </select>
                      <label className="prompt-enable-toggle">
                        <input
                          type="checkbox"
                          checked={editingPrompt.enabled}
                          onChange={(e) => setEditingPrompt((prev) => ({ ...prev, enabled: e.target.checked }))}
                        />
                        Enabled
                      </label>
                    </div>
                  ) : null}
                </div>
                <div className="prompt-actions">
                  <button className="button" onClick={() => handleTogglePromptVisibility(prompt.id, prompt.visible_in_game)} disabled={loading}>
                    {prompt.visible_in_game ? 'Hide' : 'Show'}
                  </button>
                  {editingPromptId === prompt.id ? (
                    <>
                      <button className="button button-success" onClick={() => handleSavePromptEdit(prompt.id)} disabled={loading}>
                        Save
                      </button>
                      <button className="button button-secondary" onClick={handleCancelEditPrompt} disabled={loading}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="button button-secondary" onClick={() => handleStartEditPrompt(prompt)} disabled={loading}>
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="prompt-section">
          <h3>Live Activity Feed</h3>
          <div className="teams-list" style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {(gameState.activity_feed || []).slice().reverse().map((entry) => (
              <div className="team-item" key={entry.id}>
                <div className="team-info">
                  <div className="team-title">{entry.message}</div>
                  <div className="team-score">{new Date(entry.at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            {(!gameState.activity_feed || gameState.activity_feed.length === 0) && (
              <div className="prompt-card empty">No activity yet</div>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
      </div>
    </div>
  )
}
