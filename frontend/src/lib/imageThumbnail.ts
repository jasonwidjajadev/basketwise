
export function thumbnailUrl(
  rawUrl: string | null | undefined,
  size = 100,
): string | null {
  if (!rawUrl) {
    return null
  }

  try {
    const url = new URL(rawUrl)

    if (url.hostname.endsWith('woolworths.media')) {
      const originalPath = url.pathname

      url.pathname = url.pathname.replace(
        /\/wowproductimages\/(?:large|medium|small)\//,
        '/wowproductimages/small/',
      )

      if (url.pathname !== originalPath) {
        return url.toString()
      }

      return null
    }


    if (url.hostname === 'dm.apac.cms.aldi.cx') {
      const originalPath = url.pathname

      url.pathname = url.pathname.replace(
        /\/scaleWidth\/\d+\//,
        `/scaleWidth/${size}/`,
      )

      if (url.pathname !== originalPath) {
        return url.toString()
      }

      return null
    }

    if (url.hostname === 'shop.coles.com.au') {
      if (/-th\.jpg$/i.test(url.pathname)) {
        return url.toString()
      }

      if (/\.jpg$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(
          /\.jpg$/i,
          '-th.jpg',
        )

        return url.toString()
      }

      return null
    }


    if (
      url.hostname ===
      'productimages.coles.com.au'
    ) {
      const match =
        url.pathname.match(/\/(\d+)\.jpg$/i)

      if (match) {
        const id = match[1]

        const folders = id
          .slice(0, 3)
          .split('')
          .join('/')

        return `https://shop.coles.com.au/wcsstore/Coles-CAS/images/${folders}/${id}-th.jpg`
      }

      return null
    }

    if (url.hostname.includes('shopify')) {
      url.searchParams.set(
        'width',
        String(size),
      )

      url.searchParams.set(
        'height',
        String(size),
      )

      return url.toString()
    }

    return null
  } catch {
    return null
  }
}