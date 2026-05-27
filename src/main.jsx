import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

import heroMeteorDay from './assets/hero-meteor-day.jpg'
import heroDay1 from './assets/hero-day-1.jpg'
import heroDay2 from './assets/hero-day-2.jpg'
import heroDay3 from './assets/hero-day-3.jpg'
import heroDay4 from './assets/hero-day-4.jpg'
import heroDay5 from './assets/hero-day-5.jpg'
import heroNight1 from './assets/hero-night-1.jpg'
import heroNight2 from './assets/hero-night-2.jpg'

const PIER_ID = 'spusk_so_lvami'

const REFRESH_DATA_MS = 60_000
const REFRESH_CLOCK_MS = 15_000
const SCREEN_DURATION_MS = 20_000

const SINGLE_SCREEN_METEOR_LIMIT = 8
const SINGLE_SCREEN_CRUISE_LIMIT = 8
const COMMON_SCREEN_METEOR_LIMIT = 4
const COMMON_SCREEN_CRUISE_LIMIT = 4

const GOOGLE_SHEETS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSP3pB7cq4Oj_okRU6nE4Dt7LpVtlz9N2piZ2TM1M-X22xXbNxRtY4Jg09jY387lHw3-wUxwzzdOmd4/pub?output=csv'

const heroImages = {
  meteor: heroMeteorDay,
  day: [heroDay1, heroDay2, heroDay3, heroDay4, heroDay5],
  night: [heroNight1, heroNight2],
}

const manualStatusMap = {
  delay: { label: 'ЗАДЕРЖКА', className: 'status-delay' },
  cancelled: { label: 'ОТМЕНЁН', className: 'status-cancelled' },
  boarding: { label: 'ПОСАДКА', className: 'status-boarding' },
  last_call: { label: 'ПОСЛЕДНИЙ ВЫЗОВ', className: 'status-last-call' },
  departed: { label: 'ОТПРАВЛЕН', className: 'status-departed' },
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      insideQuotes = !insideQuotes
    } else if (char === ',' && !insideQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

function csvToRows(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row = {}

    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })

    return {
      ...row,
      is_active: String(row.is_active).trim().toUpperCase() !== 'FALSE',
    }
  })
}

function parseDepartureDateTime(date, time) {
  const [year, month, day] = String(date).split('-').map(Number)
  const [hours, minutes] = String(time).split(':').map(Number)

  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

function getDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getAutoStatus(departure, now) {
  const diffMinutes = Math.round((departure.getTime() - now.getTime()) / 60000)

  if (diffMinutes > 30) return { label: 'ПО РАСПИСАНИЮ', className: 'status-scheduled' }
  if (diffMinutes > 15) return { label: 'ОЖИДАЕТСЯ ПОСАДКА', className: 'status-waiting' }
  if (diffMinutes > 3) return { label: 'ПОСАДКА', className: 'status-boarding' }
  if (diffMinutes >= 0) return { label: 'ПОСЛЕДНИЙ ВЫЗОВ', className: 'status-last-call' }

  return { label: 'ОТПРАВЛЕН', className: 'status-departed' }
}

function getStatus(row, now) {
  const manual = String(row.manual_status || '').trim()

  if (manual && manualStatusMap[manual]) {
    return manualStatusMap[manual]
  }

  const departure = parseDepartureDateTime(row.date, row.time)
  return getAutoStatus(departure, now)
}

function shouldShowRow(row, now) {
  if (row.is_active === false || String(row.is_active).toUpperCase() === 'FALSE') return false

  const departure = parseDepartureDateTime(row.date, row.time)
  const minutesAfterDeparture = (now.getTime() - departure.getTime()) / 60000
  const manual = String(row.manual_status || '').trim()

  if (manual === 'delay' || manual === 'cancelled') return true

  return minutesAfterDeparture <= 15
}

function normalizeRows(rows, now) {
  const today = getDateKey(now)
  const activeRows = rows.filter((row) => row.pier_id === PIER_ID && shouldShowRow(row, now))

  let visibleRows = activeRows.filter((row) => row.date === today)

  if (visibleRows.length === 0 && activeRows.length > 0) {
    const futureDates = [...new Set(activeRows.map((row) => row.date))].sort()
    const nextDate = futureDates.find((date) => date >= today) || futureDates[0]
    visibleRows = activeRows.filter((row) => row.date === nextDate)
  }

  return visibleRows
    .map((row) => ({
      ...row,
      departure: parseDepartureDateTime(row.date, row.time),
      status: getStatus(row, now),
    }))
    .sort((a, b) => a.departure - b.departure)
}

function groupRows(rows) {
  return {
    meteor: rows.filter((row) => row.category === 'meteor'),
    other: rows.filter((row) => row.category !== 'meteor'),
  }
}

function getHeroRows(rows) {
  const priorityRows = rows.filter((row) => {
    const status = row.status?.className
    return status === 'status-boarding' || status === 'status-last-call' || status === 'status-waiting'
  })

  return (priorityRows.length ? priorityRows : rows).slice(0, 3)
}

function getHeroImage(screenType, screenIndex, now) {
  const hour = now.getHours()

  if (screenType === 'meteor') return heroImages.meteor

  if (hour >= 20 || hour < 6) {
    return heroImages.night[screenIndex % heroImages.night.length]
  }

  return heroImages.day[screenIndex % heroImages.day.length]
}

function DepartureRow({ row }) {
  return (
    <div className="departure-row">
      <div className="time">{row.time}</div>

      <div className="route">
        <div className="route-title">{row.route}</div>
        {row.note ? <div className="note">{row.note}</div> : null}
      </div>

      <div className="ship">{row.ship}</div>

      <div className={`status ${row.status.className}`}>
        {row.status.label}
      </div>
    </div>
  )
}
function IdlePanel() {
  return (
    <div className="idle-panel">
      {/* <div className="idle-card">
        <div className="idle-label">Навигация</div>
        <div className="idle-value">
          Рейсы на сегодня завершены
        </div>
        <div className="idle-sub">
          Расписание обновится автоматически
        </div>
      </div>
      */}

      <div className="idle-card">
        <div className="idle-label">Билеты онлайн</div>
        <div className="idle-value">astra-marine.ru</div>
        <div className="idle-sub">
          Проверьте расписание и купите билет на сайте
        </div>
      </div>

      <div className="idle-card">
        <div className="idle-label">Погода сейчас</div>
        <div className="idle-value">+16°</div>
        <div className="idle-sub">
          Следите за объявлениями на причале
        </div>
      </div>

      <div className="idle-card">
        <div className="idle-label">Телефон</div>
        <div className="idle-value">+7 (812) 426-17-17</div>
        <div className="idle-sub">
          Служба заботы о пассажирах
        </div>
      </div>
    </div>
  )
}


function Section({ title, rows }) {
  if (!rows.length) return null

  return (
    <section className="section">
      {title ? <div className="section-title">{title}</div> : null}

      <div className="table-head">
        <div>Время</div>
        <div>Направление</div>
        <div>Теплоход</div>
        <div>Статус</div>
      </div>

      <div className="rows">
        {rows.map((row) => (
          <DepartureRow
            key={`${row.date}-${row.time}-${row.route}-${row.ship}`}
            row={row}
          />
        ))}
      </div>
    </section>
  )
}

function HeroZone({ rows, title }) {
  if (!rows.length) {
    return (
      <section className="hero-zone">
        <div className="hero-kicker">РАСПИСАНИЕ</div>
        <div className="hero-title">Рейсы на сегодня завершены</div>
        <div className="hero-subtitle">Расписание обновится автоматически</div>
      </section>
    )
  }

  const main = rows[0]
  const secondary = rows.slice(1)

  return (
    <section className="hero-zone">
      <div className="hero-kicker">{title}</div>

      <div className="hero-main-row">
        <div className="hero-time">{main.time}</div>
        <div className={`hero-status ${main.status.className}`}>
          {main.status.label}
        </div>
      </div>

      <div className="hero-title">{main.route}</div>
      <div className="hero-subtitle">{main.ship}</div>

      {secondary.length ? (
        <div className="hero-secondary">
          {secondary.map((row) => (
            <div className="hero-mini-card" key={`${row.date}-${row.time}-${row.route}-${row.ship}`}>
              <div className="hero-mini-time">{row.time}</div>
              <div>
                <div className="hero-mini-route">{row.route}</div>
                <div className="hero-mini-ship">{row.ship}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ScreenDots({ activeIndex, count }) {
  return (
    <div className="screen-dots">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className={index === activeIndex ? 'dot active' : 'dot'} />
      ))}
    </div>
  )
}

function App() {
  const [rows, setRows] = useState([])
  const [now, setNow] = useState(new Date())
  const [error, setError] = useState('')
  const [screenIndex, setScreenIndex] = useState(0)

  async function loadRows() {
    try {
      const separator = GOOGLE_SHEETS_CSV_URL.includes('?') ? '&' : '?'
      const response = await fetch(`${GOOGLE_SHEETS_CSV_URL}${separator}cacheBust=${Date.now()}`)

      if (!response.ok) throw new Error('Не удалось загрузить Google Sheets')

      const csvText = await response.text()
      setRows(csvToRows(csvText))
      setError('')
    } catch (err) {
      setError('Нет связи с расписанием')
    }
  }

  useEffect(() => {
    loadRows()

    const dataTimer = setInterval(loadRows, REFRESH_DATA_MS)
    const clockTimer = setInterval(() => setNow(new Date()), REFRESH_CLOCK_MS)
    const screenTimer = setInterval(() => {
      setScreenIndex((current) => (current + 1) % 3)
    }, SCREEN_DURATION_MS)

    return () => {
      clearInterval(dataTimer)
      clearInterval(clockTimer)
      clearInterval(screenTimer)
    }
  }, [])

  const visibleRows = useMemo(() => normalizeRows(rows, now), [rows, now])
  const groups = useMemo(() => groupRows(visibleRows), [visibleRows])

  const meteorRows = groups.meteor.slice(0, SINGLE_SCREEN_METEOR_LIMIT)
  const cruiseRows = groups.other.slice(0, SINGLE_SCREEN_CRUISE_LIMIT)

  const commonMeteorRows = groups.meteor.slice(0, COMMON_SCREEN_METEOR_LIMIT)
  const commonCruiseRows = groups.other.slice(0, COMMON_SCREEN_CRUISE_LIMIT)

  const screens = [
    {
      type: 'meteor',
      title: 'Метеоры',
      subtitle: 'Ближайшие отправления',
      heroTitle: 'Ближайшее отправление',
      heroRows: getHeroRows(meteorRows),
      content: <Section rows={meteorRows} />,
    },
    {
      type: 'cruise',
      title: 'Дневные и вечерние прогулки',
      subtitle: 'Ближайшие отправления',
      heroTitle: 'Ближайшее отправление',
      heroRows: getHeroRows(cruiseRows),
      content: <Section rows={cruiseRows} />,
    },
    {
      type: 'common',
      title: 'Общее расписание',
      subtitle: 'Ближайшие отправления',
      heroTitle: 'Ближайшее отправление',
      heroRows: getHeroRows(visibleRows),
      content: (
        <>
          <Section title="Метеоры" rows={commonMeteorRows} />
          <Section title="Дневные и вечерние прогулки" rows={commonCruiseRows} />
        </>
      ),
    },
  ]

  const activeScreen = screens[screenIndex]
  const heroImage = getHeroImage(activeScreen.type, screenIndex, now)

  const pierName = visibleRows[0]?.pier_name || 'Спуск со львами'
  const displayDate = visibleRows[0]?.date || getDateKey(now)

  return (
    <main
      className="board"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div className="board-overlay" />

      <header className="header">
        <div>
          <h1>{pierName}</h1>
        </div>

        <div className="meta">
          <div>{displayDate}</div>
          <div>
            {now.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </header>

      <div className="screen-title-row">
        <div>
          <div className="screen-title">{activeScreen.title}</div>
        </div>

        <ScreenDots activeIndex={screenIndex} count={screens.length} />
      </div>

      {error ? <div className="error">{error}</div> : null}

      <HeroZone rows={activeScreen.heroRows} title={activeScreen.heroTitle} />

      <div className="schedule-area">
      {activeScreen.heroRows.length ? activeScreen.content : <IdlePanel />}
      </div>

      <footer className="footer">Информация обновляется автоматически</footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)