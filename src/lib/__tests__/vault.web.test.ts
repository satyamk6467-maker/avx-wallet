import { beforeEach, describe, expect, it } from 'vitest';

// Minimal in-memory localStorage for Node.
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const mem = new MemStorage();
(globalThis as any).localStorage = mem;

const vault = await import('../vault.web');
const PHRASE = 'test test test test test test test test test test test junk';

describe('web vault', () => {
  beforeEach(async () => {
    mem.clear();
    vault.forgetUnlockKey();
  });

  it('never stores the phrase or PIN in plain text', async () => {
    await vault.saveWallet(PHRASE, '258036');
    const raw = [...mem.m.values()].join(' ');
    expect(raw).not.toContain('junk');
    expect(raw).not.toContain('258036');
    expect(await vault.hasWallet()).toBe(true);
  });

  it('unlocks with the right PIN and locks again', async () => {
    await vault.saveWallet(PHRASE, '258036');
    vault.forgetUnlockKey();
    expect(await vault.readMnemonic()).toBeNull();
    expect((await vault.verifyPin('258036')).ok).toBe(true);
    expect(await vault.readMnemonic()).toBe(PHRASE);
  });

  it('rejects a wrong PIN and locks out after 5 tries', async () => {
    await vault.saveWallet(PHRASE, '258036');
    vault.forgetUnlockKey();
    let r = await vault.verifyPin('111222');
    expect(r).toMatchObject({ ok: false, attemptsLeft: 4 });
    for (let i = 0; i < 4; i++) r = await vault.verifyPin('111222');
    expect(r.ok).toBe(false);
    expect((r as any).lockedFor).toBeGreaterThan(0);
    expect((await vault.verifyPin('258036')).ok).toBe(false); // even the right PIN waits
    expect(await vault.readMnemonic()).toBeNull();
  }, 30_000);

  it('wipe removes everything', async () => {
    await vault.saveWallet(PHRASE, '258036');
    await vault.wipeWallet();
    expect(await vault.hasWallet()).toBe(false);
    expect(mem.m.size).toBe(0);
  });
});
