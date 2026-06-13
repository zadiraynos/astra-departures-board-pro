import { useEffect } from 'react'

const DEFAULT_PROMO_KEY = 'default-promo'

function getPromoImagePath(promoKey) {
  const safePromoKey = String(promoKey || DEFAULT_PROMO_KEY).trim() || DEFAULT_PROMO_KEY
  const base = import.meta.env.BASE_URL || '/'

  return `${base}promo/${safePromoKey}.jpg`.replace(/\/{2,}/g, '/')
}

export function PromoScreen({ promoKey }) {
  const image = getPromoImagePath(promoKey)
  const fallback = getPromoImagePath(DEFAULT_PROMO_KEY)

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[PromoScreen]', { promoKey, imageUrl: image })
    }
  }, [promoKey, image])

  return (
    <section
      className="playlist-promo-screen"
      style={{ backgroundImage: `url(${image}), url(${fallback})` }}
    />
  )
}
