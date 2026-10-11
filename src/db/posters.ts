import { db } from './db'
import type { Poster } from './types'

export async function putPoster(p: Omit<Poster, 'createdAt'>): Promise<void> {
  await db.posters.put({ ...p, createdAt: Date.now() })
}

export async function getPoster(key: string): Promise<Poster | undefined> {
  return db.posters.get(key)
}

export async function deletePoster(key: string): Promise<void> {
  await db.posters.delete(key)
}

export async function countPosters(): Promise<number> {
  return db.posters.count()
}
