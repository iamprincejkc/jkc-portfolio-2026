/**
 * The generator's icon set.
 *
 * There are twenty of them and they are all one or two strokes on a 24x24
 * grid. A dependency for that would weigh more than the icons, and keeping
 * them as `currentColor` strokes means every hover and active state comes for
 * free from the surrounding CSS.
 */
export const ICON_PATHS = {
  content: 'M4 6h16M4 12h11M4 18h7',
  shape: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  color: 'M12 3c-4.5 4.2-7 7.3-7 10a7 7 0 0 0 14 0c0-2.7-2.5-5.8-7-10z',
  logo: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4L15 12l5 5',
  sparkles:
    'M12 3.5 13.7 9l5.5 1.7-5.5 1.8L12 18l-1.7-5.5L4.8 10.7 10.3 9zM18.8 15.5l.5 1.7 1.7.6-1.7.5-.5 1.7-.6-1.7-1.7-.5 1.7-.6z',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 19h14',
  link: 'M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.6 6.2M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.2-1.2',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  warning: 'M12 4 2.8 20h18.4zM12 10v4.5M12 17.2v.1',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.8v.1',
  rotate: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4',
  eye: 'M4 4h16v16H4zM8.5 8.5h7v7h-7z',
  pupil: 'M4 4h16v16H4zM9.5 9.5h5v5h-5z',
  gradient: 'M4 4h16v16H4zM4 10h16M4 15h16',
  layout: 'M4 8h16M4 12h10M4 16h16',
  upload: 'M12 19V8m0 0 4 4m-4-4-4 4M5 5h14',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M19 12H5m0 0 6-6m-6 6 6 6',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M6 12.5a9 9 0 0 1 12 0M9.4 16a4.2 4.2 0 0 1 5.2 0M12 19.4v.1',
  calendar: 'M4 6.5h16v14H4zM4 11h16M8.5 3.5V7M15.5 3.5V7',
  card: 'M3.5 5.5h17v13h-17zM9 11.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM6 15.6c.5-1.6 1.6-2.4 3-2.4s2.5.8 3 2.4M14.5 10h4M14.5 13.5h4',
} as const

export type IconName = keyof typeof ICON_PATHS
