/* ============================================
   Focus Rocket — DB Module
   IndexedDB (Dexie.js) + Supabase Sync Layer
   ============================================ */

// ============================================
// SCHEMA DEFINITION
// ============================================

const DB_NAME = 'FocusRocketDB';
const DB_VERSION = 1;

// Inizializza Dexie (caricato via CDN in index.html).
// Se il CDN non risponde, l'app resta usabile con fallback localStorage.
const hasDexie = typeof Dexie !== 'undefined';
const db = hasDexie ? new Dexie(DB_NAME) : null;

function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

if (db) db.version(DB_VERSION).stores({
    // Sessions: ogni blocco Pomodoro completato
    sessions: '++id, userId, date, blocks, minutes, synced, createdAt',

    // Tasks: micro-task creati e completati
    tasks: '++id, userId, text, completed, time, createdAt, synced',

    // Daily stats: aggregazione giornaliera
    dailyStats: 'date, userId, blocks, minutes, planned, completed, synced',

    // Achievements: progresso obiettivi
    achievements: 'id, userId, unlocked, progress, synced',

    // Settings: preferenze utente
    settings: 'key, value, synced',

    // Music: preferiti e custom playlists
    musicFavorites: 'id, title, videoId, added, synced',
    musicCustom: 'id, title, videoId, added, synced',

    // Friends: lista amici (per leaderboard)
    friends: 'id, name, avatar, score, streak, status, synced',

    // Body Doubling: conversazioni e costi
    bdConversations: '++id, userId, role, content, timestamp, synced',
    bdCosts: 'id, userId, sessionCost, totalCost, date, synced'
});

// ============================================
// SYNC STATUS
// ============================================

let supabaseClient = null;
let currentUser = null;
let syncEnabled = false;

function initSync(supabase, user) {
    supabaseClient = supabase;
    currentUser = user;
    syncEnabled = !!(supabase && user);
    if (syncEnabled) startPeriodicSync();
}

function disableSync() {
    syncEnabled = false;
    supabaseClient = null;
    currentUser = null;
}

// ============================================
// CRUD WRAPPER (offline-first)
// ============================================

const DB = {
    storageMode: db ? 'indexeddb' : 'localStorage',

    // --- SESSIONS ---
    async addSession(data) {
        if (!db) {
            const sessions = readJson('fr_sessions', []);
            const record = { id: Date.now(), ...data, userId: 'local', synced: 1, createdAt: new Date().toISOString() };
            sessions.push(record);
            writeJson('fr_sessions', sessions);
            return record.id;
        }
        const record = {
            ...data,
            userId: currentUser?.id || 'local',
            synced: syncEnabled ? 0 : 1,
            createdAt: new Date().toISOString()
        };
        const id = await db.sessions.add(record);
        if (syncEnabled) queueSync('sessions', id);
        return id;
    },

    async getSessionsByDate(date) {
        if (!db) return readJson('fr_sessions', []).filter(s => s.date === date);
        return await db.sessions.where('date').equals(date).toArray();
    },

    async getAllSessions() {
        if (!db) return readJson('fr_sessions', []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return await db.sessions.orderBy('createdAt').reverse().toArray();
    },

    // --- TASKS ---
    async saveTasks(taskList) {
        if (!db) {
            writeJson('fr_tasks', taskList);
            return;
        }
        await db.tasks.where('userId').equals(currentUser?.id || 'local').delete();
        const records = taskList.map(t => ({
            ...t,
            userId: currentUser?.id || 'local',
            synced: syncEnabled ? 0 : 1,
            createdAt: new Date().toISOString()
        }));
        await db.tasks.bulkAdd(records);
        if (syncEnabled) queueSync('tasks');
    },

    async getTasks() {
        if (!db) return readJson('fr_tasks', []);
        return await db.tasks.where('userId').equals(currentUser?.id || 'local').toArray();
    },

    // --- DAILY STATS ---
    async updateDailyStats(date, data) {
        if (!db) {
            const dailyStats = readJson('fr_daily_stats', {});
            dailyStats[date] = { date, userId: 'local', ...data, synced: 1 };
            writeJson('fr_daily_stats', dailyStats);
            return;
        }
        const existing = await db.dailyStats.get(date);
        const record = {
            date,
            userId: currentUser?.id || 'local',
            ...data,
            synced: syncEnabled ? 0 : 1
        };
        if (existing) {
            await db.dailyStats.update(date, { ...record, synced: syncEnabled ? 0 : 1 });
        } else {
            await db.dailyStats.put(record);
        }
        if (syncEnabled) queueSync('dailyStats', date);
    },

    async getDailyStats(date) {
        if (!db) return readJson('fr_daily_stats', {})[date] || { blocks: 0, minutes: 0, planned: 4, completed: 0 };
        return await db.dailyStats.get(date) || { blocks: 0, minutes: 0, planned: 4, completed: 0 };
    },

    async getDailyStatsRange(startDate, endDate) {
        if (!db) {
            return Object.values(readJson('fr_daily_stats', {}))
                .filter(s => s.date >= startDate && s.date <= endDate);
        }
        return await db.dailyStats
            .where('date')
            .between(startDate, endDate)
            .and(s => s.userId === (currentUser?.id || 'local'))
            .toArray();
    },

    // --- SETTINGS ---
    async setSetting(key, value) {
        if (!db) {
            localStorage.setItem(key, String(value));
            return;
        }
        await db.settings.put({ key, value, synced: syncEnabled ? 0 : 1 });
        if (syncEnabled) queueSync('settings', key);
    },

    async getSetting(key, defaultValue = null) {
        if (!db) {
            const value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        }
        const record = await db.settings.get(key);
        return record ? record.value : defaultValue;
    },

    // --- ACHIEVEMENTS ---
    async saveAchievements(achievements) {
        if (!db) {
            writeJson('fr_achievements', achievements);
            return;
        }
        const records = achievements.map(a => ({
            ...a,
            userId: currentUser?.id || 'local',
            synced: syncEnabled ? 0 : 1
        }));
        await db.achievements.bulkPut(records);
        if (syncEnabled) queueSync('achievements');
    },

    async getAchievements() {
        if (!db) return readJson('fr_achievements', []);
        return await db.achievements.where('userId').equals(currentUser?.id || 'local').toArray();
    },

    // --- MUSIC ---
    async saveMusicFavorites(favorites) {
        if (!db) {
            writeJson('fr_music_favorites', favorites);
            return;
        }
        await db.musicFavorites.clear();
        const records = favorites.map(f => ({ ...f, synced: 1 }));
        await db.musicFavorites.bulkAdd(records);
    },

    async getMusicFavorites() {
        if (!db) return readJson('fr_music_favorites', []);
        return await db.musicFavorites.toArray();
    },

    async saveMusicCustom(custom) {
        if (!db) {
            writeJson('fr_music_custom', custom);
            return;
        }
        await db.musicCustom.clear();
        const records = custom.map(c => ({ ...c, synced: 1 }));
        await db.musicCustom.bulkAdd(records);
    },

    async getMusicCustom() {
        if (!db) return readJson('fr_music_custom', []);
        return await db.musicCustom.toArray();
    },

    // --- FRIENDS ---
    async saveFriends(friendsList) {
        if (!db) {
            writeJson('fr_friends', friendsList);
            return;
        }
        await db.friends.clear();
        const records = friendsList.map(f => ({ ...f, synced: 1 }));
        await db.friends.bulkAdd(records);
    },

    async getFriends() {
        if (!db) return readJson('fr_friends', []);
        return await db.friends.toArray();
    },

    // --- BODY DOUBLING ---
    async addBdMessage(role, content) {
        if (!db) {
            const messages = readJson('fr_bd_conversations', []);
            messages.push({ id: Date.now(), userId: 'local', role, content, timestamp: new Date().toISOString(), synced: 1 });
            writeJson('fr_bd_conversations', messages);
            return;
        }
        await db.bdConversations.add({
            userId: currentUser?.id || 'local',
            role,
            content,
            timestamp: new Date().toISOString(),
            synced: syncEnabled ? 0 : 1
        });
    },

    async getBdConversation() {
        if (!db) return readJson('fr_bd_conversations', []).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        return await db.bdConversations
            .where('userId').equals(currentUser?.id || 'local')
            .sortBy('timestamp');
    },

    async updateBdCost(sessionCost, totalCost) {
        if (!db) {
            writeJson('fr_bd_cost', { sessionCost, totalCost, date: new Date().toISOString().split('T')[0] });
            localStorage.setItem('bdTotalCost', String(totalCost));
            return;
        }
        await db.bdCosts.put({
            id: 'current',
            userId: currentUser?.id || 'local',
            sessionCost,
            totalCost,
            date: new Date().toISOString().split('T')[0],
            synced: syncEnabled ? 0 : 1
        });
    },

    async getBdCost() {
        if (!db) return readJson('fr_bd_cost', { sessionCost: 0, totalCost: parseFloat(localStorage.getItem('bdTotalCost') || '0') });
        return await db.bdCosts.get('current') || { sessionCost: 0, totalCost: 0 };
    }
};

// ============================================
// SYNC LAYER (Supabase)
// ============================================

let syncQueue = [];
let syncTimer = null;

function queueSync(table, id = null) {
    syncQueue.push({ table, id, timestamp: Date.now() });
    if (!syncTimer) syncTimer = setTimeout(processSyncQueue, 5000); // Debounce 5s
}

async function processSyncQueue() {
    syncTimer = null;
    if (!syncEnabled || !supabaseClient || syncQueue.length === 0) return;

    const batch = [...syncQueue];
    syncQueue = [];

    for (const item of batch) {
        try {
            await syncTable(item.table, item.id);
        } catch (err) {
            console.error('Sync error:', err);
            syncQueue.push(item); // Retry later
        }
    }

    if (syncQueue.length > 0) {
        syncTimer = setTimeout(processSyncQueue, 30000); // Retry in 30s
    }
}

async function syncTable(table, id) {
    const tableMap = {
        sessions: { table: 'fr_sessions', dbTable: db.sessions },
        tasks: { table: 'fr_tasks', dbTable: db.tasks },
        dailyStats: { table: 'fr_daily_stats', dbTable: db.dailyStats },
        achievements: { table: 'fr_achievements', dbTable: db.achievements },
        settings: { table: 'fr_settings', dbTable: db.settings },
        bdConversations: { table: 'fr_bd_conversations', dbTable: db.bdConversations },
        bdCosts: { table: 'fr_bd_costs', dbTable: db.bdCosts }
    };

    const mapping = tableMap[table];
    if (!mapping) return;

    let records;
    if (id) {
        records = [await mapping.dbTable.get(id)].filter(Boolean);
    } else {
        records = await mapping.dbTable.where('synced').equals(0).toArray();
    }

    if (records.length === 0) return;

    const { error } = await supabaseClient
        .from(mapping.table)
        .upsert(records, { onConflict: 'id' });

    if (error) throw error;

    // Mark as synced
    await mapping.dbTable.where('synced').equals(0).modify({ synced: 1 });
}

function startPeriodicSync() {
    // Full sync ogni 60 secondi quando online
    setInterval(() => {
        if (navigator.onLine && syncEnabled) {
            processSyncQueue();
        }
    }, 60000);
}

// ============================================
// MIGRAZIONE da localStorage
// ============================================

async function migrateFromLocalStorage() {
    console.log('🔄 Migrating data from localStorage to IndexedDB...');

    // Sessions / Stats
    const blocks = parseInt(localStorage.getItem('fr_blocks') || '0');
    const minutes = parseInt(localStorage.getItem('fr_minutes') || '0');
    const streak = parseInt(localStorage.getItem('fr_streak') || '0');
    const lastDate = localStorage.getItem('fr_lastDate');

    if (blocks > 0 || minutes > 0) {
        const today = new Date().toISOString().split('T')[0];
        await DB.updateDailyStats(today, { blocks, minutes, planned: 4, completed: blocks });
        await DB.setSetting('legacy_streak', streak);
        await DB.setSetting('legacy_lastDate', lastDate);
    }

    // Tasks
    const tasks = JSON.parse(localStorage.getItem('fr_tasks') || '[]');
    if (tasks.length > 0) {
        await DB.saveTasks(tasks);
    }

    // Music
    const favorites = JSON.parse(localStorage.getItem('fr_music_favorites') || '[]');
    if (favorites.length > 0) await DB.saveMusicFavorites(favorites);

    const custom = JSON.parse(localStorage.getItem('fr_music_custom') || '[]');
    if (custom.length > 0) await DB.saveMusicCustom(custom);

    // Settings
    const settingsKeys = ['fr_theme', 'fr_gentle', 'fr_sound_enabled', 'fr_sound_effect', 
                          'fr_sound_volume', 'fr_default_mode', 'fr_break_mode', 'fr_auto_start_break'];
    for (const key of settingsKeys) {
        const value = localStorage.getItem(key);
        if (value !== null) {
            await DB.setSetting(key, value);
        }
    }

    // Achievements
    const achievements = JSON.parse(localStorage.getItem('fr_achievements') || 'null');
    if (achievements) await DB.saveAchievements(achievements);

    // Friends
    const friends = JSON.parse(localStorage.getItem('fr_friends') || '[]');
    if (friends.length > 0) await DB.saveFriends(friends);

    // BD Costs
    const bdTotalCost = parseFloat(localStorage.getItem('bdTotalCost') || '0');
    if (bdTotalCost > 0) await DB.updateBdCost(0, bdTotalCost);

    console.log('✅ Migration complete');
    showToast('📦 Dati migrati in IndexedDB!', 'success');
}

// ============================================
// EXPORT / IMPORT
// ============================================

async function exportAllData() {
    if (!db) {
        return {
            sessions: readJson('fr_sessions', []),
            tasks: readJson('fr_tasks', []),
            dailyStats: Object.values(readJson('fr_daily_stats', {})),
            achievements: readJson('fr_achievements', []),
            settings: Object.keys(localStorage).filter(k => k.startsWith('fr_') || k.startsWith('legacy_')).map(key => ({ key, value: localStorage.getItem(key) })),
            musicFavorites: readJson('fr_music_favorites', []),
            musicCustom: readJson('fr_music_custom', []),
            friends: readJson('fr_friends', []),
            bdConversations: readJson('fr_bd_conversations', []),
            bdCosts: [readJson('fr_bd_cost', { sessionCost: 0, totalCost: 0 })],
            exportedAt: new Date().toISOString()
        };
    }
    const data = {
        sessions: await db.sessions.toArray(),
        tasks: await db.tasks.toArray(),
        dailyStats: await db.dailyStats.toArray(),
        achievements: await db.achievements.toArray(),
        settings: await db.settings.toArray(),
        musicFavorites: await db.musicFavorites.toArray(),
        musicCustom: await db.musicCustom.toArray(),
        friends: await db.friends.toArray(),
        bdConversations: await db.bdConversations.toArray(),
        bdCosts: await db.bdCosts.toArray(),
        exportedAt: new Date().toISOString()
    };
    return data;
}

async function importAllData(data) {
    if (!db) {
        if (data.sessions) writeJson('fr_sessions', data.sessions);
        if (data.tasks) writeJson('fr_tasks', data.tasks);
        if (data.dailyStats) {
            const dailyStats = {};
            data.dailyStats.forEach(s => { if (s.date) dailyStats[s.date] = s; });
            writeJson('fr_daily_stats', dailyStats);
        }
        if (data.achievements) writeJson('fr_achievements', data.achievements);
        if (data.settings) data.settings.forEach(s => localStorage.setItem(s.key, s.value));
        if (data.musicFavorites) writeJson('fr_music_favorites', data.musicFavorites);
        if (data.musicCustom) writeJson('fr_music_custom', data.musicCustom);
        if (data.friends) writeJson('fr_friends', data.friends);
        if (data.bdConversations) writeJson('fr_bd_conversations', data.bdConversations);
        if (data.bdCosts?.[0]) writeJson('fr_bd_cost', data.bdCosts[0]);
        return;
    }
    if (data.sessions) await db.sessions.bulkPut(data.sessions);
    if (data.tasks) await db.tasks.bulkPut(data.tasks);
    if (data.dailyStats) await db.dailyStats.bulkPut(data.dailyStats);
    if (data.achievements) await db.achievements.bulkPut(data.achievements);
    if (data.settings) await db.settings.bulkPut(data.settings);
    if (data.musicFavorites) await db.musicFavorites.bulkPut(data.musicFavorites);
    if (data.musicCustom) await db.musicCustom.bulkPut(data.musicCustom);
    if (data.friends) await db.friends.bulkPut(data.friends);
    if (data.bdConversations) await db.bdConversations.bulkPut(data.bdConversations);
    if (data.bdCosts) await db.bdCosts.bulkPut(data.bdCosts);
}
