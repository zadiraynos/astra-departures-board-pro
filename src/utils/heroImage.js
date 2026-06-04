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

const heroVisualConfig = {
  'astra-day': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'astra-sunset': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'astra-night': {
    position: 'center 45%',
    scale: 1.15,
    brightness: 1.2,
    overlayStrength: 'light',
  },
  'koryshka-day': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'koryshka-sunset': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'koryshka-night': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'ryapushka-day': {
    position: 'center 65%',
    scale: 1.2,
    brightness: 1.1,
    overlayStrength: 'light',
  },
  'ryapushka-sunset': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'ryapushka-night': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'm194-day': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
  'm194-night': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
  'm194-party': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
  'alenka-night': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
  'palmira-night': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
  'cityblues-night': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
  'meteor': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'meteor-peterhof': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'meteor-kronstadt': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'light',
  },
  'festival-day': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
  'default': {
    position: 'center center',
    scale: 1,
    brightness: 1,
    overlayStrength: 'medium',
  },
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

function getHeroKey(departure) {
  const explicitHeroKey = normalizeKey(getFieldValue(departure, ['hero_key', 'heroKey', 'Hero Key', 'HERO_KEY']))

  if (explicitHeroKey) {
    return explicitHeroKey
  }

  const ship = normalizeShip(departure?.ship)
  return shipToHeroKey[ship] || 'default'
}

export function getHeroImage(departure) {
  return getHeroPath(getHeroKey(departure))
}

export function getHeroImageFallback() {
  return getHeroPath('default')
}

export function getHeroVisualConfig(departure) {
  const heroKey = getHeroKey(departure)
  const config = heroVisualConfig[heroKey] || {}

  return {
    heroKey,
    position: config.position || 'center center',
    scale: config.scale || 1,
    brightness: config.brightness || 1,
    overlayStrength: config.overlayStrength || 'medium',
  }
}
