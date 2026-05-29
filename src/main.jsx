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
const SCREEN_DURATION_MS = 15_000
const NAVIGATION_DAY_START_HOUR = 5

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

function getOperationalDateKey(date) {
  const operationalDate = new Date(date)

  if (operationalDate.getHours() < NAVIGATION_DAY_START_HOUR) {
    operationalDate.setDate(operationalDate.getDate() - 1)
  }

  return getDateKey(operationalDate)
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

function getTimeLeftText(row, now) {
  const diffMinutes = Math.round((row.departure.getTime() - now.getTime()) / 60000)

  if (diffMinutes > 60) {
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `До отправления: ${hours} ч ${minutes} мин`
  }

  if (diffMinutes > 0) return `До отправления: ${diffMinutes} мин`
  if (diffMinutes > -15) return 'Рейс отправляется'

  return 'Рейс отправлен'
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
  const currentOperationalDate = getOperationalDateKey(now)

  const activeRows = rows.filter((row) => {
    if (row.pier_id !== PIER_ID) return false
    if (!shouldShowRow(row, now)) return false

    const departure = parseDepartureDateTime(row.date, row.time)
    const rowOperationalDate = getOperationalDateKey(departure)

    return rowOperationalDate === currentOperationalDate
  })

  return activeRows
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
  const heroAllowedRows = rows.filter((row) => {
    return String(row.show_in_hero || '').trim().toUpperCase() !== 'FALSE'
  })

  const priorityRows = heroAllowedRows.filter((row) => {
    const status = row.status?.className
    return status === 'status-boarding' || status === 'status-last-call' || status === 'status-waiting'
  })

  return (priorityRows.length ? priorityRows : heroAllowedRows).slice(0, 3)
}

function getHeroImageForRow(row, screenType, screenIndex, now) {
  const hour = now.getHours()

  if (!row) {
    if (hour >= 20 || hour < 6) return heroImages.night[screenIndex % heroImages.night.length]
    return heroImages.day[screenIndex % heroImages.day.length]
  }

  const route = String(row.route || '').toLowerCase()
  const ship = String(row.ship || '').toLowerCase()
  const category = String(row.category || '').toLowerCase()

  if (category === 'meteor' || screenType === 'meteor') {
    return heroImages.meteor
  }

  if (
    route.includes('мост') ||
    route.includes('джаз') ||
    route.includes('ноч') ||
    ship.includes('астра')
  ) {
    return heroImages.night[screenIndex % heroImages.night.length]
  }

  if (
    route.includes('финский') ||
    route.includes('лахта') ||
    route.includes('петергоф') ||
    route.includes('парадный')
  ) {
    return heroImages.day[2]
  }

  if (
    route.includes('северные') ||
    route.includes('остров') ||
    route.includes('реки') ||
    route.includes('каналы')
  ) {
    return heroImages.day[screenIndex % heroImages.day.length]
  }

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
      <div className="idle-card">
        <div className="idle-label">Билеты онлайн</div>
        <div className="idle-value">astra-marine.ru</div>
        <div className="idle-sub">Проверьте расписание и купите билет на сайте</div>
      </div>

      <div className="idle-card">
        <div className="idle-label">Погода сейчас</div>
        <div className="idle-value">+16°</div>
        <div className="idle-sub">Следите за объявлениями на причале</div>
      </div>

      <div className="idle-card">
        <div className="idle-label">Телефон</div>
        <div className="idle-value">+7 (812) 426-17-17</div>
        <div className="idle-sub">Служба заботы о пассажирах</div>
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

function HeroZone({ rows, title, now, image, isLateMode }) {
  if (!rows.length) {
    return (
      <section
        className={isLateMode ? 'hero-zone hero-zone-late' : 'hero-zone'}
        style={{ backgroundImage: `url(${image})` }}
      >
        <div className="hero-kicker">РАСПИСАНИЕ</div>
        <div className="hero-title">Рейсы на сегодня завершены</div>
        <div className="hero-subtitle">Расписание обновится автоматически</div>
      </section>
    )
  }

  const main = rows[0]

  return (
    <section
      className={isLateMode ? 'hero-zone hero-zone-late' : 'hero-zone'}
      style={{ backgroundImage: `url(${image})` }}
    >
      <div className="hero-kicker">{title}</div>

      <div className="hero-main-row">
        <div className="hero-time">{main.time}</div>
        <div className={`hero-status ${main.status.className}`}>
          {main.status.label}
        </div>
      </div>

      <div className="hero-title">{main.route}</div>
      <div className="hero-subtitle">{main.ship}</div>

      <div className="hero-countdown">
        {getTimeLeftText(main, now)}
      </div>

      {isLateMode ? (
        <div className="late-caption">
          Ночной Петербург • Развод мостов • Атмосфера на воде
        </div>
      ) : null}
    </section>
  )
}

function ScreenDots({ activeIndex, count }) {
  if (count <= 1) return null

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

    return () => {
      clearInterval(dataTimer)
      clearInterval(clockTimer)
    }
  }, [])

  const visibleRows = useMemo(() => normalizeRows(rows, now), [rows, now])
  const groups = useMemo(() => groupRows(visibleRows), [visibleRows])

  const meteorRows = groups.meteor.slice(0, SINGLE_SCREEN_METEOR_LIMIT)
  const cruiseRows = groups.other.slice(0, SINGLE_SCREEN_CRUISE_LIMIT)

  const commonMeteorRows = groups.meteor.slice(0, COMMON_SCREEN_METEOR_LIMIT)
  const commonCruiseRows = groups.other.slice(0, COMMON_SCREEN_CRUISE_LIMIT)

  const screens = useMemo(() => {
    const result = []

    if (meteorRows.length) {
      result.push({
        type: 'meteor',
        title: 'Метеоры',
        heroTitle: 'Ближайшее отправление',
        heroRows: getHeroRows(meteorRows),
        content: <Section rows={meteorRows} />,
      })
    }

    if (cruiseRows.length) {
      result.push({
        type: 'cruise',
        title: 'Дневные и вечерние прогулки',
        heroTitle: 'Ближайшее отправление',
        heroRows: getHeroRows(cruiseRows),
        content: <Section rows={cruiseRows} />,
      })
    }

    if (meteorRows.length && cruiseRows.length) {
      result.push({
        type: 'common',
        title: 'Общее расписание',
        heroTitle: 'Ближайшее отправление',
        heroRows: getHeroRows(visibleRows),
        content: (
          <>
            <Section title="Метеоры" rows={commonMeteorRows} />
            <Section title="Дневные и вечерние прогулки" rows={commonCruiseRows} />
          </>
        ),
      })
    }

    if (!result.length) {
      result.push({
        type: 'idle',
        title: 'Расписание',
        heroTitle: 'Расписание',
        heroRows: [],
        content: <IdlePanel />,
      })
    }

    return result
  }, [meteorRows, cruiseRows, commonMeteorRows, commonCruiseRows, visibleRows])

  useEffect(() => {
    setScreenIndex(0)
  }, [screens.length])

  useEffect(() => {
    if (screens.length <= 1) return undefined

    const screenTimer = setInterval(() => {
      setScreenIndex((current) => (current + 1) % screens.length)
    }, SCREEN_DURATION_MS)

    return () => clearInterval(screenTimer)
  }, [screens.length])

  const activeScreen = screens[screenIndex] || screens[0]
  const activeHeroRow = activeScreen.heroRows[0]
  const heroImage = getHeroImageForRow(activeHeroRow, activeScreen.type, screenIndex, now)

  const hour = now.getHours()
  const isLateMode =
    (hour >= 22 || hour < NAVIGATION_DAY_START_HOUR) &&
    activeScreen.heroRows.length > 0 &&
    visibleRows.length <= 2

  const pierName = visibleRows[0]?.pier_name || 'Спуск со львами'
  const displayDate = visibleRows[0]?.date || getOperationalDateKey(now)

  return (
    <main className={isLateMode ? 'board late-mode' : 'board'}>
      <div className="board-overlay" />

      <header className="header">
        <h1>{pierName}</h1>

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
        <div className="screen-title">{activeScreen.title}</div>
        <ScreenDots activeIndex={screenIndex} count={screens.length} />
      </div>

      {error ? <div className="error">{error}</div> : null}

      <HeroZone
        rows={activeScreen.heroRows}
        title={activeScreen.heroTitle}
        now={now}
        image={heroImage}
        isLateMode={isLateMode}
      />

      <div className="schedule-area">
        {activeScreen.heroRows.length ? activeScreen.content : <IdlePanel />}
      </div>

      <footer className="footer">Информация обновляется автоматически</footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)