import React, { useState, useRef, useEffect, useMemo } from 'react'
import { getClinicWhatsApp } from '../lib/config.js'

const SUGGESTIONS = [
  '🌿 Acne & breakouts',
  '✨ Pigmentation & dark spots',
  '⏳ Fine lines & wrinkles',
  '📅 Book a slot'
]

function getTomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function getQuickDays() {
  const list = []
  for (let i = 1; i <= 5; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    const label = i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    list.push({ date: dateStr, label })
  }
  return list
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamStatus, setStreamStatus] = useState(null)
  const [selectedDate, setSelectedDate] = useState(getTomorrowStr())
  const [dynamicSlots, setDynamicSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState(null)
  const [manualSlotPicker, setManualSlotPicker] = useState(false)
  const [slotSelected, setSlotSelected] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content:
        'Hello! Share your skin concern with us, and we will help you book a consultation slot with Dr. Aishwarya for a personalized treatment plan.'
    }
  ])

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const quickDays = useMemo(() => getQuickDays(), [])

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('chat-open')
    } else {
      document.body.classList.remove('chat-open')
    }
    return () => {
      document.body.classList.remove('chat-open')
    }
  }, [isOpen])

  // Fetch slots whenever selectedDate changes if picker is active
  useEffect(() => {
    if (!selectedDate) return
    let active = true
    setSlotsLoading(true)
    setSlotsError(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    fetch(`/api/slots?from=${selectedDate}&days=1`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (!active) return
        const day = data.days?.[0]
        if (day && Array.isArray(day.slots)) {
          setDynamicSlots(day.slots)
        } else {
          setDynamicSlots([])
        }
      })
      .catch((err) => {
        console.error('Failed to load slots for chat picker:', err)
        if (active) {
          setDynamicSlots([])
          setSlotsError(err.name === 'AbortError' ? 'timeout' : 'error')
        }
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (active) setSlotsLoading(false)
      })

    return () => {
      active = false
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [selectedDate])

  // Only show slot picker if:
  // 1. User clicked "📅 Book a slot" or explicitly requested slots (manualSlotPicker)
  // 2. The bot is actively in date/slot selection mode
  // AND:
  // - A slot has NOT already been selected in this flow (slotSelected is false)
  // - The bot is NOT asking for name, phone, or confirming details
  // - The appointment is NOT already booked
  const isBotAskingForDate = useMemo(() => {
    if (messages.length <= 1) return false
    const last = messages[messages.length - 1]
    if (last.role !== 'model') return false

    // If an appointment is already booked, never show slot picker
    if (last.booked) return false

    const botText = (last.content || '').toLowerCase()

    // If the bot is asking for contact details or confirming, slot selection is completed
    if (
      botText.includes('name') ||
      botText.includes('phone') ||
      botText.includes('contact number') ||
      botText.includes('confirmed for') ||
      botText.includes('details to proceed') ||
      botText.includes('details to finalize')
    ) {
      return false
    }

    // Explicit UI metadata from check_availability tool (when user is in selection process)
    if (last.ui?.type === 'slots' || last.ui?.type === 'days') {
      return true
    }

    // Require explicit action phrases to avoid triggering on general words
    const isExplicitlyAskingToPick =
      botText.includes('select a date') ||
      botText.includes('select a slot') ||
      botText.includes('choose a slot') ||
      botText.includes('choose a date') ||
      botText.includes('pick a date') ||
      botText.includes('pick a slot') ||
      botText.includes('preferred date') ||
      botText.includes('available consultation slot') ||
      botText.includes('below:')

    return isExplicitlyAskingToPick
  }, [messages])

  // Slot picker disappears ("goes back") once a slot is selected, even if manualSlotPicker was previously true
  const showSlotPicker = !slotSelected && (isBotAskingForDate || manualSlotPicker)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [isOpen, messages, loading, showSlotPicker])

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    // If user explicitly asks to pick or change a slot, re-open picker
    if (
      /change (date|time|slot)|different (date|time|slot)|book a slot|reschedule|pick another/i.test(text)
    ) {
      setSlotSelected(false)
      setManualSlotPicker(true)
    } else if (
      /slot selected|appointment slot|\b(202\d-\d{2}-\d{2})\b.*?\b\d{1,2}:\d{2}\b/i.test(text)
    ) {
      setSlotSelected(true)
      setManualSlotPicker(false)
    } else {
      setManualSlotPicker(false)
    }

    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setStreamStatus("Connecting with Dr. Aishwarya's team...")

    try {
      const apiPayload = newMessages.map((m) => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content
      }))

      let res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify({ messages: apiPayload, stream: true })
      })

      // Client-side retry with a short delay on 429 before showing the canned message
      if (res.status === 429) {
        setStreamStatus("Connecting with clinic concierge (brief retry)...")
        await new Promise((r) => setTimeout(r, 1500))
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
          },
          body: JSON.stringify({ messages: apiPayload, stream: true })
        })
      }

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream') && res.body) {
        // Append empty bot placeholder message to stream tokens into
        setMessages((prev) => [...prev, { role: 'model', content: '', ui: null }])

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith(':')) continue

            if (trimmed.startsWith('event: status')) {
              continue
            }

            if (trimmed.startsWith('data:')) {
              try {
                const data = JSON.parse(trimmed.replace(/^data:\s*/, ''))
                if (data.status) {
                  setStreamStatus(data.status)
                }
                if (data.token) {
                  setStreamStatus(null)
                  setMessages((prev) => {
                    const next = [...prev]
                    const lastIdx = next.length - 1
                    if (lastIdx >= 0 && next[lastIdx].role === 'model') {
                      next[lastIdx] = {
                        ...next[lastIdx],
                        content: (next[lastIdx].content || '') + data.token
                      }
                    }
                    return next
                  })
                }
                if (data.ui) {
                  if (data.ui.date) setSelectedDate(data.ui.date)
                  setMessages((prev) => {
                    const next = [...prev]
                    const lastIdx = next.length - 1
                    if (lastIdx >= 0 && next[lastIdx].role === 'model') {
                      next[lastIdx] = { ...next[lastIdx], ui: data.ui }
                    }
                    return next
                  })
                }
                if (data.done) {
                  setStreamStatus(null)
                }
              } catch (_) {}
            }
          }
        }
      } else {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Unable to connect to assistant.')
        }

        const botReply = data.reply || data.message || data.text || 'Unable to process your request.'
        if (data.ui?.date) {
          setSelectedDate(data.ui.date)
        }
        setMessages([...newMessages, { role: 'model', content: botReply, ui: data.ui, booked: data.booked }])
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        // If an empty streaming placeholder was added, replace it with friendly error
        const next = [...prev]
        const lastIdx = next.length - 1
        const waNum = getClinicWhatsApp()
        const fallbackMsg = waNum
          ? `Dr. Aishwarya’s booking concierge is experiencing a brief connection delay. Please feel free to select a consultation slot below or reach our clinic directly on WhatsApp at ${waNum}.`
          : 'Dr. Aishwarya’s booking concierge is experiencing a brief connection delay. Please feel free to select a consultation slot below or reach our clinic concierge.'

        if (lastIdx >= 0 && next[lastIdx].role === 'model' && !next[lastIdx].content) {
          next[lastIdx] = {
            role: 'model',
            content: fallbackMsg
          }
          return next
        }
        return [
          ...prev,
          {
            role: 'model',
            content: fallbackMsg
          }
        ]
      })
    } finally {
      setLoading(false)
      setStreamStatus(null)
    }
  }

  const handleSelectSlot = (slotTime) => {
    if (!selectedDate) return
    setSlotSelected(true)
    setManualSlotPicker(false)
    const msg = `Appointment slot selected: ${selectedDate} at ${slotTime}`
    handleSend(msg)
  }

  const handleSuggestionClick = (s) => {
    if (s === '📅 Book a slot') {
      setSlotSelected(false)
      setManualSlotPicker(true)
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: 'Please choose your preferred date and available consultation slot below:'
        }
      ])
    } else {
      handleSend(s)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-widget-root">
      {/* Floating Toggle Button */}
      <button
        type="button"
        className={`chat-toggle-btn ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open AI consultation chat'}
      >
        <span className="chat-toggle-icon">
          {isOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          )}
        </span>
        <span className="chat-toggle-label">Dr. Aishwarya Team</span>
        <span className="chat-online-pulse" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">🌿</div>
              <div>
                <h3 className="chat-title">Dr. Aishwarya Team</h3>
                <p className="chat-subtitle">
                  <span className="chat-status-dot" /> The Skin Tree Concierge
                </p>
              </div>
            </div>
            <button
              type="button"
              className="chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Body */}
          <div className="chat-messages">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`chat-message-row ${m.role === 'user' ? 'is-user' : 'is-bot'}`}
              >
                {m.role === 'model' && <div className="chat-msg-avatar">🌿</div>}
                <div className="chat-bubble">
                  {m.content.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i !== m.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                  {/* If message has booked details, show confirmation card */}
                  {m.booked && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#F4F7F4', borderRadius: '6px', border: '1px solid #D1E0D1', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#1B3B2B' }}>✓ Appointment Reserved</div>
                      <div style={{ color: '#4A5568', marginTop: '2px' }}>
                        Date: {m.booked.date} at {m.booked.time}
                      </div>
                      {m.booked.manageToken && (
                        <a
                          href={`/manage/${m.booked.manageToken}`}
                          style={{ display: 'inline-block', marginTop: '6px', color: '#1B3B2B', textDecoration: 'underline', fontSize: '0.8rem' }}
                        >
                          Manage or reschedule appointment →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Interactive Date & Available Slots Selector */}
            {showSlotPicker && !loading && (
              <div className="chat-slot-picker-card">
                <div className="slot-picker-header">
                  <span className="slot-picker-title">📅 Select Date</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="date"
                      min={getTomorrowStr()}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="slot-picker-date-input"
                    />
                    <button
                      type="button"
                      className="slot-picker-close-btn"
                      onClick={() => {
                        setManualSlotPicker(false)
                        setSlotSelected(true)
                      }}
                      aria-label="Close date picker"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="slot-picker-quick-dates">
                  {quickDays.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      className={`slot-date-chip ${selectedDate === d.date ? 'is-selected' : ''}`}
                      onClick={() => setSelectedDate(d.date)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {selectedDate && (
                  <div className="slot-picker-times-section">
                    <div className="slot-picker-subtitle">
                      Available slots on <strong>{selectedDate}</strong>:
                    </div>
                    {slotsLoading ? (
                      <div style={{ fontSize: '0.82rem', color: '#718096', padding: '0.5rem 0' }}>
                        Checking live calendar...
                      </div>
                    ) : slotsError ? (
                      <div style={{ fontSize: '0.82rem', color: '#C53030', padding: '0.5rem 0' }}>
                        Unable to connect to live calendar right now.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            const cur = selectedDate
                            setSelectedDate('')
                            setTimeout(() => setSelectedDate(cur), 50)
                          }}
                          style={{ textDecoration: 'underline', color: 'var(--color-forest)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        >
                          Retry
                        </button>
                        {getClinicWhatsApp() && (
                          <div style={{ marginTop: '4px' }}>
                            Or <a href={`https://wa.me/${getClinicWhatsApp().replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'var(--color-forest)' }}>WhatsApp clinic directly</a>.
                          </div>
                        )}
                      </div>
                    ) : dynamicSlots.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: '#A0AEC0', padding: '0.5rem 0' }}>
                        No open slots on this date. Please try another day.
                      </div>
                    ) : (
                      <div className="slot-picker-grid">
                        {dynamicSlots.map((s) => {
                          const timeStr = typeof s === 'string' ? s : s.time
                          const isAvail = typeof s === 'object' ? s.available : true
                          return (
                            <button
                              key={timeStr}
                              type="button"
                              className={`slot-time-btn ${!isAvail ? 'is-disabled' : ''}`}
                              disabled={!isAvail}
                              onClick={() => handleSelectSlot(timeStr)}
                              title={!isAvail ? 'Slot unavailable' : `Select ${timeStr}`}
                            >
                              {timeStr}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="chat-message-row is-bot">
                <div className="chat-msg-avatar">🌿</div>
                <div className="chat-bubble is-loading">
                  {streamStatus ? (
                    <span style={{ fontSize: '0.8rem', color: '#6A584A', fontStyle: 'italic' }}>
                      {streamStatus}
                    </span>
                  ) : (
                    <>
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions (Shown on first turns) */}
          {messages.length <= 2 && !loading && !showSlotPicker && (
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="chat-suggestion-chip"
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <form
            className="chat-footer"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder={
                showSlotPicker
                  ? 'Or type your details here...'
                  : 'Describe your skin concern or reply...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
