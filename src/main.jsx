import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { getHeroImage, getHeroImageFallback } from './utils/heroImage'

import promoMeteor from './assets/promos/promo-meteor.jpg'
import promoParties from './assets/promos/promo-parties.jpg'
import promoPeterhofRestaurant from './assets/promos/promo-petergof-restaurant.jpg'
import promoBridges from './assets/promos/promo-bridges.jpg'
import promoFamily from './assets/promos/promo-family.jpg'

const PIER_ID = 'spusk_so_lvami'

const REFRESH_DATA_MS = 10_000
const REFRESH_CLOCK_MS = 15_000
const SCREEN_DURATION_MS = 15_000
const HERO_ROTATION_MS = 6_000
const PROMO_ROTATION_MS = 8_000
const SCREEN_FADE_MS = 850
const NAVIGATION_DAY_START_HOUR = 5

const SINGLE_SCREEN_METEOR_LIMIT = 8
const SINGLE_SCREEN_CRUISE_LIMIT = 8
const COMMON_SCREEN_METEOR_LIMIT = 4
const COMMON_SCREEN_CRUISE_LIMIT = 4

const GOOGLE_SHEETS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSP3pB7cq4Oj_okRU6nE4Dt7LpVtlz9N2piZ2TM1M-X22xXbNxRtY4Jg09jY387lHw3-wUxwzzdOmd4/pub?output=csv'

const promoBanners = [
  {
    image: promoMeteor,
    position: 'center top',
    title: 'Метеоры в Петергоф',
    subtitle: 'Быстрый маршрут по воде без городских пробок',
  },
  {
    image: promoParties,
    position: 'center center',
    title: 'Праздники на воде',
    subtitle: 'Вечеринки, выпускные и частные события на теплоходе',
  },
  {
    image: promoPeterhofRestaurant,
    position: 'center center',
    title: 'Петергоф с рестораном',
    subtitle: 'Прогулка на метеоре и гастрономический день у залива',
  },
  {
    image: promoBridges,
    position: 'center center',
    title: 'Разводные мосты',
    subtitle: 'Ночной Петербург с лучшего ракурса',
  },
  {
    image: promoFamily,
    position: 'center top',
    title: 'Семейные прогулки',
    subtitle: 'Спокойный маршрут для детей и взрослых',
  },
]

function getHeroBackgroundImage(image) {
  return `url(${image}), url(${getHeroImageFallback()})`
}

const manualStatusMap = {
  delay: { label: 'ЗАДЕРЖКА', className: 'status-delay' },
  cancelled: { label: 'ОТМЕНЁН', className: 'status-cancelled' },
  boarding: { label: 'ПОСАДКА', className: 'status-boarding' },
  last_call: { label: 'ПОСЛЕДНИЙ ВЫЗОВ', className: 'status-last-call' },
  departed: { label: 'ОТПРАВЛЕН', className: 'status-departed' },
}

const heroStatusPriority = {
  'status-last-call': 0,
  'status-boarding': 1,
  'status-waiting': 2,
}

const manualStatusAliases = {
  delay: ['delay', 'delayed', 'задержка', 'задерживается', 'рейсзадерживается'],
  cancelled: ['cancelled', 'canceled', 'cancel', 'отменен', 'отмена', 'рейсотменен'],
  boarding: ['boarding', 'посадка'],
  last_call: ['lastcall', 'последнийвызов'],
  departed: ['departed', 'отправлен', 'рейсотправлен'],
}

function normalizeStatusValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/^status[-_\s]*/, '')
    .replace(/[^a-zа-я0-9]/g, '')
}

function getStatusKeyFromValue(value) {
  const status = normalizeStatusValue(value)

  if (!status) return ''

  for (const [key, aliases] of Object.entries(manualStatusAliases)) {
    if (status === key.replace('_', '') || aliases.includes(status)) return key
  }

  return ''
}

function getManualStatusKey(row) {
  const values = [
    row.manual_status,
    row.manualStatus,
    typeof row.status === 'string' ? row.status : null,
    row.status?.className,
    row.status?.label,
  ]

  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeStatusValue(key)

    if (normalizedKey.includes('status') || normalizedKey.includes('статус')) {
      values.push(value)
    }
  })

  for (const value of values) {
    const key = getStatusKeyFromValue(value)

    if (manualStatusMap[key]) return key
  }

  return ''
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
  const manual = getManualStatusKey(row)

  if (manual && manualStatusMap[manual]) {
    return manualStatusMap[manual]
  }

  const departure = parseDepartureDateTime(row.date, row.time)
  return getAutoStatus(departure, now)
}

function getTimeLeftText(row, now) {
  const manual = getManualStatusKey(row)

  if (manual === 'delay') return 'Рейс задерживается'
  if (manual === 'cancelled') return 'Рейс отменён'
  if (manual === 'departed') return 'Рейс отправлен'

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

function getCategoryKey(row) {
  return String(row.category || '').trim().toLowerCase()
}

function shouldShowRow(row, now) {
  if (row.is_active === false || String(row.is_active).toUpperCase() === 'FALSE') return false

  const departure = parseDepartureDateTime(row.date, row.time)
  const minutesAfterDeparture = (now.getTime() - departure.getTime()) / 60000
  const manual = getManualStatusKey(row)

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
    meteor: rows.filter((row) => getCategoryKey(row) === 'meteor'),
    other: rows.filter((row) => getCategoryKey(row) !== 'meteor'),
  }
}

function shouldShowInHero(row) {
  return String(row.show_in_hero || '').trim().toUpperCase() !== 'FALSE'
}

function isSameDeparture(a, b) {
  if (!a || !b) return false
  if (a.id && b.id) return a.id === b.id

  return (
    a.date === b.date &&
    a.time === b.time &&
    a.route === b.route &&
    a.ship === b.ship
  )
}

function getHeroRows(rows) {
  const heroAllowedRows = rows.filter(shouldShowInHero)

  return [...heroAllowedRows]
    .sort((a, b) => {
      const aPriority = heroStatusPriority[a.status?.className] ?? 3
      const bPriority = heroStatusPriority[b.status?.className] ?? 3

      if (aPriority !== bPriority) return aPriority - bPriority

      return a.departure - b.departure
    })
    .slice(0, 3)
}

function getHeroImageForRow(row) {
  return getHeroImage(row)
}

function getHeroKeyForDebug(row) {
  if (!row) return ''

  const directValue = row.hero_key || row.heroKey
  if (directValue) return directValue

  const heroKeyField = Object.keys(row).find((key) => key.trim().toLowerCase() === 'hero_key')
  return heroKeyField ? row[heroKeyField] : ''
}

function getScheduleRouteTitle(route) {
  const normalizedRoute = String(route || '').trim().toLowerCase()

  if (normalizedRoute.includes('парадный петербург') && normalizedRoute.includes('финский залив')) {
    return 'Парадный Петербург'
  }

  return route
}

function DepartureRow({ row }) {
  return (
    <div className="departure-row">
      <div className="time">{row.time}</div>

      <div className="route">
        <div className="route-title">{getScheduleRouteTitle(row.route)}</div>
        {row.note ? <div className="note">{row.note}</div> : null}
      </div>

      <div className="ship">{row.ship}</div>

      <div className={`status ${row.status.className}`}>
        {row.status.label}
      </div>
    </div>
  )
}

function PromotionBanner({ banner }) {
  return (
    <article
      className="promotion-banner"
      style={{
        backgroundImage: `url(${banner.image})`,
        backgroundPosition: banner.position || 'center center',
      }}
    >
    </article>
  )
}

function IdlePanel({ promo }) {
  return (
    <div className="promotion-idle">
      <PromotionBanner banner={promo} />

      <div className="promotion-contact">
        <div className="promotion-contact-value promotion-contact-phone">+7 (812) 426-17-17</div>
        <div className="promotion-contact-value promotion-contact-site">astra-marine.ru</div>
      </div>
    </div>
  )
}

function PromotionSchedule({ rows, promo }) {
  return (
    <>
      {rows.length ? <Section rows={rows} /> : null}
      <PromotionBanner banner={promo} />
    </>
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
        {rows.map((row, index) => (
          <DepartureRow
            key={row.id || `${row.date}-${row.time}-${row.route}-${row.ship}-${index}`}
            row={row}
          />
        ))}
      </div>
    </section>
  )
}

function HeroZone({ rows, title, now, image, isLateMode, activeIndex, enablePhotoZoom }) {
  if (!rows.length) {
    return (
      <section
        className={
          [
            'hero-zone',
            isLateMode ? 'hero-zone-late' : '',
            enablePhotoZoom ? 'hero-zone-photo-zoom' : '',
          ].filter(Boolean).join(' ')
        }
        style={{ '--hero-image': getHeroBackgroundImage(image) }}
      >
        <div className="hero-content">
          <div className="hero-kicker">РАСПИСАНИЕ</div>
          <div className="hero-title">Рейсы на сегодня завершены</div>
          <div className="hero-subtitle">Расписание обновится автоматически</div>
        </div>
      </section>
    )
  }

  const heroRows = rows.slice(0, 3)
  const main = heroRows[activeIndex % heroRows.length] || heroRows[0]

  return (
    <section
      className={
        [
          'hero-zone',
          isLateMode ? 'hero-zone-late' : '',
          enablePhotoZoom ? 'hero-zone-photo-zoom' : '',
        ].filter(Boolean).join(' ')
      }
      style={{ '--hero-image': getHeroBackgroundImage(image) }}
    >
      <div className="hero-content">
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
      </div>
    </section>
  )
}

function CommonHeroCard({ label, row, image }) {
  if (!row) return null

  return (
    <article
      className="common-hero-card"
      style={{ backgroundImage: getHeroBackgroundImage(image) }}
    >
      <div className="common-hero-card-top">
        <div className="common-hero-label">{label}</div>
        <div className={`common-hero-status ${row.status.className}`}>
          {row.status.label}
        </div>
      </div>

      <div className="common-hero-time">{row.time}</div>
      <div className="common-hero-route">{row.route}</div>
      <div className="common-hero-ship">{row.ship}</div>
    </article>
  )
}

function CommonHeroZone({ meteorRow, cruiseRow, meteorImage, cruiseImage }) {
  return (
    <section className="common-hero-grid">
      <CommonHeroCard label="Метеоры" row={meteorRow} image={meteorImage} />
      <CommonHeroCard label="Водные прогулки" row={cruiseRow} image={cruiseImage} />
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
  const [heroRotationIndex, setHeroRotationIndex] = useState(0)
  const [promoIndex, setPromoIndex] = useState(0)
  const [isScreenFading, setIsScreenFading] = useState(false)

  async function loadRows() {
    try {
      const separator = GOOGLE_SHEETS_CSV_URL.includes('?') ? '&' : '?'
      const response = await fetch(`${GOOGLE_SHEETS_CSV_URL}${separator}cacheBust=${Date.now()}`, {
        cache: 'no-store',
      })

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
    const promoTimer = setInterval(() => {
      setPromoIndex((current) => (current + 1) % promoBanners.length)
    }, PROMO_ROTATION_MS)

    return () => {
      clearInterval(dataTimer)
      clearInterval(clockTimer)
      clearInterval(promoTimer)
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
        rows: meteorRows,
        content: <Section rows={meteorRows} />,
      })
    }

    if (cruiseRows.length) {
      result.push({
        type: 'cruise',
        title: 'Дневные и вечерние прогулки',
        heroTitle: 'Ближайшее отправление',
        heroRows: getHeroRows(cruiseRows),
        rows: cruiseRows,
        content: <Section rows={cruiseRows} />,
      })
    }

    if (meteorRows.length && cruiseRows.length) {
      const commonMeteorHeroRows = getHeroRows(meteorRows)
      const commonCruiseHeroRows = getHeroRows(cruiseRows)

      result.push({
        type: 'common',
        title: 'Общее расписание',
        heroTitle: 'Ближайшее отправление',
        heroRows: getHeroRows(visibleRows),
        rows: visibleRows,
        splitHeroRows: {
          meteor: commonMeteorHeroRows[0],
          cruise: commonCruiseHeroRows[0],
        },
        scheduleRows: {
          meteor: commonMeteorRows.length,
          cruise: commonCruiseRows.length,
        },
        content: (
          <>
            <Section title="Метеоры" rows={commonMeteorRows} />
            <Section title="Водные прогулки" rows={commonCruiseRows} />
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
    setHeroRotationIndex(0)
    setIsScreenFading(false)
  }, [screens.length])

  useEffect(() => {
    if (screens.length <= 1) {
      setIsScreenFading(false)
      return undefined
    }

    let fadeTimer

    const screenTimer = setInterval(() => {
      setIsScreenFading(true)

      fadeTimer = window.setTimeout(() => {
        setHeroRotationIndex(0)
        setScreenIndex((current) => (current + 1) % screens.length)
        setIsScreenFading(false)
      }, SCREEN_FADE_MS)
    }, SCREEN_DURATION_MS)

    return () => {
      clearInterval(screenTimer)
      window.clearTimeout(fadeTimer)
    }
  }, [screens.length])

  const activeScreen = screens[screenIndex] || screens[0]
  const heroRotationLimit = Math.min(activeScreen.heroRows.length, 3)
  const activeHeroIndex = heroRotationLimit > 0 ? heroRotationIndex % heroRotationLimit : 0
  const activeHeroRow = activeScreen.heroRows[activeHeroIndex]
  const primaryHeroRow = activeScreen.heroRows[0]
  const heroImage = getHeroImageForRow(activeHeroRow)
  const activePromo = promoBanners[promoIndex % promoBanners.length]
  const commonScheduleStyle =
    activeScreen.type === 'common'
      ? {
          gridTemplateRows: 'max-content max-content',
        }
      : undefined

  useEffect(() => {
    setHeroRotationIndex(0)
  }, [screenIndex])

  useEffect(() => {
    if (!activeHeroRow) return

    console.log('[Hero image]', {
      route: activeHeroRow.route,
      ship: activeHeroRow.ship,
      hero_key: getHeroKeyForDebug(activeHeroRow),
      imageUrl: heroImage,
    })
  }, [activeHeroRow, heroImage])

  useEffect(() => {
    if (heroRotationLimit <= 1) {
      setHeroRotationIndex(0)
      return undefined
    }

    const heroTimer = setInterval(() => {
      setHeroRotationIndex((current) => (current + 1) % heroRotationLimit)
    }, HERO_ROTATION_MS)

    return () => clearInterval(heroTimer)
  }, [heroRotationLimit, screenIndex])

  const hour = now.getHours()
  const isLateMode =
    (hour >= 22 || hour < NAVIGATION_DAY_START_HOUR) &&
    activeScreen.heroRows.length > 0 &&
    visibleRows.length <= 2
  const isLowDensityMode = visibleRows.length > 0 && visibleRows.length <= 3
  const isPromotionMode =
    isLowDensityMode &&
    activeScreen.type !== 'common' &&
    activeScreen.type !== 'idle'
  const promotionRows = isPromotionMode
    ? (activeScreen.rows || []).filter((row) => !isSameDeparture(row, primaryHeroRow))
    : []
  const boardClassName = [
    'board',
    activeScreen.type === 'idle' ? 'idle-mode' : '',
    isLateMode ? 'late-mode' : '',
    isLowDensityMode ? 'low-density' : '',
    isPromotionMode ? 'promotion-mode' : '',
  ].filter(Boolean).join(' ')

  const pierName = visibleRows[0]?.pier_name || 'Спуск со львами'
  const displayDate = visibleRows[0]?.date || getOperationalDateKey(now)

  return (
    <main className={boardClassName}>
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

      <div className={isScreenFading ? 'screen-content screen-content-fading' : 'screen-content'}>
        {activeScreen.type !== 'idle' ? (
          <div className="screen-title-row">
            <div className="screen-title">{activeScreen.title}</div>
            <ScreenDots activeIndex={screenIndex} count={screens.length} />
          </div>
        ) : null}

        {error ? <div className="error">{error}</div> : null}

        {activeScreen.type === 'idle' ? null : activeScreen.type === 'common' ? (
          <CommonHeroZone
            meteorRow={activeScreen.splitHeroRows?.meteor}
            cruiseRow={activeScreen.splitHeroRows?.cruise}
            meteorImage={getHeroImageForRow(activeScreen.splitHeroRows?.meteor)}
            cruiseImage={getHeroImageForRow(activeScreen.splitHeroRows?.cruise)}
          />
        ) : (
          <HeroZone
            rows={activeScreen.heroRows}
            title={activeScreen.heroTitle}
            now={now}
            image={heroImage}
            isLateMode={isLateMode}
            activeIndex={activeHeroIndex}
            enablePhotoZoom={activeScreen.heroRows.length === 1}
          />
        )}

        <div
          className={
            [
              'schedule-area',
              activeScreen.type === 'common' ? 'common-schedule' : '',
              activeScreen.type === 'idle' ? 'promotion-idle-area' : '',
              isPromotionMode ? 'promotion-schedule' : '',
              isPromotionMode && !promotionRows.length ? 'promotion-schedule-empty' : '',
              isPromotionMode && promotionRows.length === 1 ? 'promotion-schedule-single' : '',
            ].filter(Boolean).join(' ')
          }
          style={commonScheduleStyle}
        >
          {activeScreen.type === 'idle' ? (
            <IdlePanel promo={activePromo} />
          ) : isPromotionMode ? (
            <PromotionSchedule rows={promotionRows} promo={activePromo} />
          ) : (
            activeScreen.content
          )}
        </div>
      </div>

      <footer className="footer">Информация обновляется автоматически</footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
