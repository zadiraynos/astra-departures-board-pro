const DEFAULT_HERO_IMAGE = '/hero/default.jpg'

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

export function getHeroImage(departure) {
  const explicitHeroKey = normalizeKey(departure?.hero_key)

  if (explicitHeroKey) {
    return `/hero/${explicitHeroKey}.jpg`
  }

  const ship = normalizeShip(departure?.ship)
  const heroKey = shipToHeroKey[ship] || 'default'

  return `/hero/${heroKey}.jpg`
}

export function getHeroImageFallback() {
  return DEFAULT_HERO_IMAGE
}
