export const HALL_FORMATS = [
  '普通',
  'IMAX',
  '杜比影院',
  '巨幕',
  '4K',
  '其他',
] as const
export type HallFormat = (typeof HALL_FORMATS)[number]

export const VERSION_TYPES = [
  '原版字幕',
  '国语配音',
  '修复重映',
  '其他',
] as const
export type VersionType = (typeof VERSION_TYPES)[number]

/** 评分 5 星半星制：0.5 – 5.0，共 10 档 */
export const RATING_MAX = 5
export const RATING_STEP = 0.5

/** 超过这个天数没导出，就提醒备份 */
export const BACKUP_REMINDER_DAYS = 14
