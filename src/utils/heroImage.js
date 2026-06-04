const shipToHeroKey = {
  'астра': 'astra-day',
  'корюшка': 'koryshka-day',
  'ряпушка': 'ryapushka-day',
  'метеор': 'meteor',
  'аленка': 'alenka-night',
  'пальмира': 'palmira-night',
  'сити блюз': 'cityblues-night',
  'city blues': 'cityblues-night',
  'м-194': 'm194-day',
  'м194': 'm194-day',
  'm194': 'm194-day',
  'фестиваль': 'festival-day',
}

function normalizeKey(value) {
  return String(value || '').trim()
}

function normalizeShip(value) {
  return String(value || '').trim().toLowerCase()
}

function getFieldValue(row, names) {
  if (!row) return ''

  for (const name of names) {
    if (row[name]) return row[name]
  }

  const normalizedNames = names.map((name) => name.toLowerCase())
  const foundKey = Object.keys(row).find((key) => {
    const normalizedKey = key.trim().toLowerCase()
    return normalizedNames.includes(normalizedKey)
  })

  return foundKey ? row[foundKey] : ''
}

function getHeroPath(heroKey) {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}hero/${heroKey}.jpg`.replace(/\/{2,}/g, '/')
}

export function getHeroImage(departure) {
  const explicitHeroKey = normalizeKey(getFieldValue(departure, ['hero_key', 'heroKey', 'Hero Key', 'HERO_KEY']))

  if (explicitHeroKey) {
    return getHeroPath(explicitHeroKey)
  }

  const ship = normalizeShip(departure?.ship)
  const heroKey = shipToHeroKey[ship] || 'default'

  return getHeroPath(heroKey)
}

export function getHeroImageFallback() {
  return getHeroPath('default')
}
