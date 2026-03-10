import { useEffect, useRef } from 'react'

export const useScrollAnimation = (): React.RefObject<HTMLElement | null> => {
  const elementRef = useRef<HTMLElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.classList.add('visible')
          // Disconnect after animating to save resources
          observerRef.current?.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    )

    observerRef.current.observe(element)

    // Cleanup on unmount
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return elementRef
}
