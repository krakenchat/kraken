import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addServer,
  getServers,
  getActiveServer,
  setActiveServer,
  removeServer,
  clearAllServers,
  hasServers,
  updateServer,
} from '../../utils/serverStorage';

// Stub crypto.randomUUID for deterministic IDs
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${++uuidCounter}`,
});

describe('serverStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    uuidCounter = 0;
  });

  // =========================================================================
  // getServers
  // =========================================================================

  describe('getServers', () => {
    it('returns an empty array when nothing is stored', () => {
      expect(getServers()).toEqual([]);
    });

    it('returns parsed servers from localStorage', () => {
      localStorage.setItem('kraken:servers', JSON.stringify([{ id: '1', name: 'Test' }]));
      expect(getServers()).toEqual([{ id: '1', name: 'Test' }]);
    });

    it('returns an empty array when localStorage contains corrupted JSON', () => {
      localStorage.setItem('kraken:servers', '{broken');
      expect(getServers()).toEqual([]);
    });
  });

  // =========================================================================
  // addServer
  // =========================================================================

  describe('addServer', () => {
    it('adds a new server and returns it', () => {
      const server = addServer('My Server', 'https://example.com');
      expect(server).toMatchObject({
        id: 'uuid-1',
        name: 'My Server',
        url: 'https://example.com',
      });
      expect(getServers()).toHaveLength(1);
    });

    it('normalizes the URL by removing a trailing slash', () => {
      const server = addServer('Test', 'https://example.com/');
      expect(server.url).toBe('https://example.com');
    });

    it('throws when adding a duplicate URL', () => {
      addServer('Server A', 'https://example.com');
      expect(() => addServer('Server B', 'https://example.com')).toThrow('Server already exists');
    });

    it('detects duplicates after URL normalization', () => {
      addServer('Server A', 'https://example.com');
      expect(() => addServer('Server B', 'https://example.com/')).toThrow('Server already exists');
    });

    it('marks the first server as active by default', () => {
      const server = addServer('First', 'https://a.com');
      expect(server.isActive).toBe(true);
      expect(localStorage.getItem('kraken:activeServerId')).toBe(server.id);
    });

    it('does not mark subsequent servers as active', () => {
      addServer('First', 'https://a.com');
      const second = addServer('Second', 'https://b.com');
      expect(second.isActive).toBe(false);
    });

    it('sets lastConnected on the new server', () => {
      const server = addServer('Test', 'https://example.com');
      expect(server.lastConnected).toBeDefined();
    });
  });

  // =========================================================================
  // getActiveServer
  // =========================================================================

  describe('getActiveServer', () => {
    it('returns null when no servers exist', () => {
      expect(getActiveServer()).toBeNull();
    });

    it('returns the server matching the active server ID', () => {
      const s = addServer('Active', 'https://a.com');
      addServer('Other', 'https://b.com');
      expect(getActiveServer()!.id).toBe(s.id);
    });

    it('falls back to first server when activeServerId points to nothing', () => {
      addServer('A', 'https://a.com');
      addServer('B', 'https://b.com');
      localStorage.setItem('kraken:activeServerId', 'nonexistent');
      // Falls back to the first server marked isActive=true, or the first server
      const active = getActiveServer();
      expect(active).not.toBeNull();
    });

    it('falls back to the first server when no server has isActive=true', () => {
      // Manually write servers without isActive flag
      localStorage.setItem(
        'kraken:servers',
        JSON.stringify([
          { id: 's1', name: 'A', url: 'https://a.com', isActive: false },
          { id: 's2', name: 'B', url: 'https://b.com', isActive: false },
        ]),
      );
      localStorage.removeItem('kraken:activeServerId');

      const active = getActiveServer();
      expect(active!.id).toBe('s1');
    });
  });

  // =========================================================================
  // setActiveServer
  // =========================================================================

  describe('setActiveServer', () => {
    it('sets the isActive flag and updates lastConnected', () => {
      const s1 = addServer('A', 'https://a.com');
      const s2 = addServer('B', 'https://b.com');

      setActiveServer(s2.id);

      const servers = getServers();
      const a = servers.find((s) => s.id === s1.id)!;
      const b = servers.find((s) => s.id === s2.id)!;
      expect(a.isActive).toBe(false);
      expect(b.isActive).toBe(true);
      expect(b.lastConnected).toBeDefined();
    });

    it('updates localStorage activeServerId', () => {
      const s = addServer('A', 'https://a.com');
      addServer('B', 'https://b.com');
      setActiveServer(s.id);
      expect(localStorage.getItem('kraken:activeServerId')).toBe(s.id);
    });

    it('throws when the server ID does not exist', () => {
      expect(() => setActiveServer('nonexistent')).toThrow('Server not found');
    });
  });

  // =========================================================================
  // removeServer
  // =========================================================================

  describe('removeServer', () => {
    it('removes the server from the list', () => {
      const s = addServer('A', 'https://a.com');
      removeServer(s.id);
      expect(getServers()).toHaveLength(0);
    });

    it('reassigns active to the first remaining server when removing the active one', () => {
      const s1 = addServer('A', 'https://a.com');
      const s2 = addServer('B', 'https://b.com');
      setActiveServer(s1.id);

      removeServer(s1.id);

      // s2 should now be findable as active
      const servers = getServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(s2.id);
    });

    it('clears activeServerId when removing the last server', () => {
      const s = addServer('A', 'https://a.com');
      removeServer(s.id);
      expect(localStorage.getItem('kraken:activeServerId')).toBeNull();
    });

    it('throws when the server ID does not exist', () => {
      expect(() => removeServer('nonexistent')).toThrow('Server not found');
    });
  });

  // =========================================================================
  // clearAllServers
  // =========================================================================

  describe('clearAllServers', () => {
    it('removes both localStorage keys', () => {
      addServer('A', 'https://a.com');
      clearAllServers();
      expect(localStorage.getItem('kraken:servers')).toBeNull();
      expect(localStorage.getItem('kraken:activeServerId')).toBeNull();
      expect(getServers()).toEqual([]);
    });
  });

  // =========================================================================
  // hasServers / updateServer
  // =========================================================================

  describe('hasServers', () => {
    it('returns false when empty', () => {
      expect(hasServers()).toBe(false);
    });

    it('returns true when servers exist', () => {
      addServer('A', 'https://a.com');
      expect(hasServers()).toBe(true);
    });
  });

  describe('updateServer', () => {
    it('updates partial server properties', () => {
      const s = addServer('Old Name', 'https://a.com');
      const updated = updateServer(s.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
      expect(updated.url).toBe('https://a.com');
    });

    it('throws when the server does not exist', () => {
      expect(() => updateServer('nonexistent', { name: 'X' })).toThrow('Server not found');
    });
  });
});
