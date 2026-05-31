/* ============================================
   Focus Rocket — DB Module
   IndexedDB (Dexie.js) + Supabase Sync Layer
   ============================================ */

// ============================================
// SCHEMA DEFINITION
// ============================================

const DB_NAME = 'FocusRocketDB';
const DB_VERSION = 1;

// Inizializza Dexie (caricato via CDN in index.html)
const db = new Dexie(DB_NAME);

db.version(DB_VERSION).stores({
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
    // --- SESSIONS ---
    async addSession(data) {
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
        return await db.sessions.where('date').equals(date).toArray();
    },

    async getAllSessions() {
        return await db.sessions.orderBy('createdAt').reverse().toArray();
    },

    // --- TASKS ---
    async saveTasks(taskList) {
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
        return await db.tasks.where('userId').equals(currentUser?.id || 'local').toArray();
    },

    // --- DAILY STATS ---
    async updateDailyStats(date, data) {
        const key = `${date}_${currentUser?.id || 'local'}`;
        const existing = await db.dailyStats.get(key);
        const record = {
            date,
            userId: currentUser?.id || 'local',
            ...data,
            synced: syncEnabled ? 0 : 1
        };
        if (existing) {
            await db.dailyStats.update(key, { ...record, synced: 0 });
        } else {
            await db.dailyStats.add(record);
        }
        if (syncEnabled) queueSync('dailyStats', key);
    },

    async getDailyStats(date) {
        const key = `${date}_${currentUser?.id || 'local'}`;
        return await db.dailyStats.get(key) || { blocks: 0, minutes: 0, planned: 4, completed: 0 };
    },

    async getDailyStatsRange(startDate, endDate) {
        return await db.dailyStats
            .where('date')
            .between(startDate, endDate)
            .and(s => s.userId === (currentUser?.id || 'local'))
            .toArray();
    },

    // --- SETTINGS ---
    async setSetting(key, value) {
        await db.settings.put({ key, value, synced: syncEnabled ? 0 : 1 });
        if (syncEnabled) queueSync('settings', key);
    },

    async getSetting(key, defaultValue = null) {
        const record = await db.settings.get(key);
        return record ? record.value : defaultValue;
    },

    // --- ACHIEVEMENTS ---
    async saveAchievements(achievements) {
        const records = achievements.map(a => ({
            ...a,
            userId: currentUser?.id || 'local',
            synced: syncEnabled ? 0 : 1
        }));
        await db.achievements.bulkPut(records);
        if (syncEnabled) queueSync('achievements');
    },

    async getAchievements() {
        return await db.achievements.where('userId').equals(currentUser?.id || 'local').toArray();
    },

    // --- MUSIC ---
    async saveMusicFavorites(favorites) {
        await db.musicFavorites.clear();
        const records = favorites.map(f => ({ ...f, synced: 1 }));
        await db.musicFavorites.bulkAdd(records);
    },

    async getMusicFavorites() {
        return await db.musicFavorites.toArray();
    },

    async saveMusicCustom(custom) {
        await db.musicCustom.clear();
        const records = custom.map(c => ({ ...c, synced: 1 }));
        await db.musicCustom.bulkAdd(records);
    },

    async getMusicCustom() {
        return await db.musicCustom.toArray();
    },

    // --- FRIENDS ---
    async saveFriends(friendsList) {
        await db.friends.clear();
        const records = friendsList.map(f => ({ ...f, synced: 1 }));
        await db.friends.bulkAdd(records);
    },

    async getFriends() {
        return await db.friends.toArray();
    },

    // --- BODY DOUBLING ---
    async addBdMessage(role, content) {
        await db.bdConversations.add({
            userId: currentUser?.id || 'local',
            role,
            content,
            timestamp: new Date().toISOString(),
            synced: syncEnabled ? 0 : 1
        });
    },

    async getBdConversation() {
        return await db.bdConversations
            .where('userId').equals(currentUser?.id || 'local')
            .sortBy('timestamp');
    },

    async updateBdCost(sessionCost, totalCost) {
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
        await db.settings.put({ key: 'legacy_streak', value: streak, synced: 1 });
        await db.settings.put({ key: 'legacy_lastDate', value: lastDate, synced: 1 });
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
