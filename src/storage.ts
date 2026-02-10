import fs from 'fs/promises';
import path from 'path';
import { Session } from './types.js';

const DATA_DIR = './data/sessions';

export async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // 目录已存在
  }
}

export async function saveSession(session: Session): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `${session.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  try {
    const filePath = path.join(DATA_DIR, `${sessionId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Session;
  } catch (error) {
    return null;
  }
}

export async function listSessions(): Promise<Session[]> {
  await ensureDataDir();
  try {
    const files = await fs.readdir(DATA_DIR);
    const sessions: Session[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
        sessions.push(JSON.parse(content));
      }
    }
    
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    return [];
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
