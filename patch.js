const fs = require('fs');
const path = require('path');

const file = path.join('backend', 'services', 'gamificationCore.js');
let content = fs.readFileSync(file, 'utf8');

// Replace imports to include more db functions
content = content.replace(
  /import \{ readDB \} from '\.\.\/middleware\/db\.js';/,
  `import { readDB, writeDB, findOne, findAll, insertOne, updateOne, upsertOne, deleteOne } from '../middleware/db.js';\nimport { randomUUID } from 'crypto';`
);

// 1. getOrCreateGamification
content = content.replace(
  /export async function getOrCreateGamification\(userId\) \{[\s\S]*?async function updateLeaderboard/m,
  `export async function getOrCreateGamification(userId) {
  const supabase = getSupabase();
  let profile = null;

  if (supabase) {
    const { data } = await supabase.from('gamification_profiles').select('*').eq('user_id', userId).single();
    profile = data;
  } else {
    profile = await findOne('gamification_profiles', p => p.user_id === userId);
  }

  if (profile) {
    return {
      userId: profile.user_id,
      xp: parseInt(profile.xp),
      level: profile.level,
      streak: profile.streak,
      lastStreakDate: profile.last_streak_date,
      badges: []
    };
  }

  const newProfile = {
    user_id: userId,
    xp: 0,
    level: 1,
    streak: 0,
    last_streak_date: null,
    updated_at: nowIso(),
    created_at: nowIso()
  };

  if (supabase) {
    await supabase.from('gamification_profiles').insert(newProfile);
  } else {
    await insertOne('gamification_profiles', newProfile);
  }
  
  await updateLeaderboard(userId, 0);

  return {
    userId, xp: 0, level: 1, streak: 0, lastStreakDate: null, badges: []
  };
}

async function updateLeaderboard`
);

// 2. updateLeaderboard
content = content.replace(
  /async function updateLeaderboard\(userId, xp\) \{[\s\S]*?export async function awardXp/m,
  `async function updateLeaderboard(userId, xp) {
  const rank_name = getRankName(xp);
  const entry = { user_id: userId, xp_total: xp, rank_name, updated_at: nowIso() };
  
  const supabase = getSupabase();
  if (supabase) {
    await supabase.from('leaderboard').upsert(entry);
  } else {
    await upsertOne('leaderboard', r => r.user_id === userId, entry);
  }
}

export async function awardXp`
);

// 3. awardXp
content = content.replace(
  /export async function awardXp\(userId, amount, reason = 'xp_awarded', opts = \{\}\) \{[\s\S]*?export function xpFromQuizScore/m,
  `export async function awardXp(userId, amount, reason = 'xp_awarded', opts = {}) {
  const delta = Number(amount) || 0;
  if (delta <= 0) return getOrCreateGamification(userId);

  const profile = await getOrCreateGamification(userId);
  let newStreak = profile.streak;
  let lastDate = profile.lastStreakDate;
  
  const d = todayUTC();
  if (lastDate !== d) {
    if (!lastDate) {
      newStreak = 1;
    } else {
      const prev = new Date(\`\${lastDate}T12:00:00Z\`);
      const cur = new Date(\`\${d}T12:00:00Z\`);
      const diffDays = Math.round((cur - prev) / (24 * 3600 * 1000));
      
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        let shieldData = null;
        const supabase = getSupabase();
        if (supabase) {
           const { data } = await supabase.from('streak_shields').select('shields_remaining').eq('user_id', userId).single();
           shieldData = data;
        } else {
           shieldData = await findOne('streak_shields', s => s.user_id === userId);
        }
        
        if (shieldData && shieldData.shields_remaining > 0) {
           if (supabase) {
             await supabase.from('streak_shields').update({ shields_remaining: shieldData.shields_remaining - 1, updated_at: nowIso() }).eq('user_id', userId);
           } else {
             await updateOne('streak_shields', s => s.user_id === userId, { shields_remaining: shieldData.shields_remaining - 1, updated_at: nowIso() });
           }
           newStreak += 1;
        } else {
           newStreak = 1;
        }
      }
    }
    lastDate = d;
  }

  const newXp = profile.xp + delta;
  const newLevel = computeLevel(newXp);

  const updates = { xp: newXp, level: newLevel, streak: newStreak, last_streak_date: lastDate, updated_at: nowIso() };
  const supabase = getSupabase();
  if (supabase) {
    await supabase.from('gamification_profiles').update(updates).eq('user_id', userId);
  } else {
    await updateOne('gamification_profiles', p => p.user_id === userId, updates);
  }

  await updateLeaderboard(userId, newXp);

  if (reason) {
    const rL = reason.toLowerCase();
    const w = rL.includes('career') || rL.includes('interview') || rL.includes('arena') ? 'career' : 'study';
    await incrementQuest(userId, w, rL, 1).catch(()=>null);
  }

  return { userId, xp: newXp, level: newLevel, streak: newStreak, lastStreakDate: lastDate };
}

export function xpFromQuizScore`
);

// 4. getOrCreateDailyQuests
content = content.replace(
  /export async function getOrCreateDailyQuests\(userId, world\) \{[\s\S]*?export async function incrementQuest/m,
  `export async function getOrCreateDailyQuests(userId, world) {
  const dateStr = todayUTC();
  const supabase = getSupabase();
  let existing = [];
  
  if (supabase) {
    const { data } = await supabase.from('daily_quests').select('*').eq('user_id', userId).eq('category', world || 'global').gt('expires_at', nowIso());
    existing = data || [];
  } else {
    existing = await findAll('daily_quests', q => q.user_id === userId && q.category === (world || 'global') && new Date(q.expires_at) > new Date());
  }

  if (existing && existing.length >= 3) {
    const allClaimed = existing.every(q => q.status === 'claimed');
    if (allClaimed) {
      const ids = existing.map(q => q.id || q.row_id);
      if (supabase) {
        await supabase.from('daily_quests').delete().in('id', ids);
      } else {
        const allQuests = await findAll('daily_quests');
        await writeDB('daily_quests', allQuests.filter(q => !ids.includes(q.id || q.row_id)));
      }
    } else {
      return existing;
    }
  }

  if (supabase) {
    await supabase.from('daily_quests').delete().eq('user_id', userId).eq('category', world);
  } else {
    const allQuests = await findAll('daily_quests');
    await writeDB('daily_quests', allQuests.filter(q => !(q.user_id === userId && q.category === world)));
  }

  const expires_at = new Date();
  expires_at.setUTCHours(23, 59, 59, 999);
  
  const generated = await generateAiQuests(userId, world || 'global');
  
  const toInsert = generated.map(q => ({
    id: randomUUID(),
    user_id: userId,
    title: q.title,
    description: q.description,
    xp_reward: q.xpReward,
    category: world || 'global',
    status: 'completed',
    progress: q.target || 1,
    target: q.target || 1,
    slug: q.slug,
    expires_at: expires_at.toISOString(),
  }));

  if (supabase) {
    const { data } = await supabase.from('daily_quests').insert(toInsert).select('*');
    return data || [];
  } else {
    for (const doc of toInsert) await insertOne('daily_quests', doc);
    return toInsert;
  }
}

export async function incrementQuest`
);

// 5. incrementQuest
content = content.replace(
  /export async function incrementQuest\(userId, world, slugMatch, inc = 1\) \{[\s\S]*?export async function claimQuest/m,
  `export async function incrementQuest(userId, world, slugMatch, inc = 1) {
  let quests = [];
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.from('daily_quests').select('*').eq('user_id', userId).eq('status', 'pending');
    quests = data || [];
  } else {
    quests = await findAll('daily_quests', q => q.user_id === userId && q.status === 'pending');
  }

  if (!quests.length) return;

  for (const q of quests) {
    if (q.slug && q.slug.includes(slugMatch)) {
       const cur = clamp(q.progress + inc, 0, q.target);
       let status = 'pending';
       if (cur >= q.target) {
          status = 'completed';
       }
       if (supabase) {
         await supabase.from('daily_quests').update({ progress: cur, status, updated_at: nowIso() }).eq('id', q.id);
       } else {
         await updateOne('daily_quests', row => (row.id === q.id || row.row_id === q.id), { progress: cur, status, updated_at: nowIso() });
       }
    }
  }
}

export async function claimQuest`
);

// 6. claimQuest
content = content.replace(
  /export async function claimQuest\(userId, questId\) \{[\s\S]*?export async function listLeaderboard/m,
  `export async function claimQuest(userId, questId) {
   let q = null;
   const supabase = getSupabase();
   
   if (supabase) {
     const { data } = await supabase.from('daily_quests').select('*').eq('id', questId).single();
     q = data;
   } else {
     q = await findOne('daily_quests', row => (row.id === questId || row.row_id === questId));
   }

   if (!q) return { error: 'Quest not found' };
   if (q.status === 'claimed') return { error: 'Already claimed' };
   if (q.status !== 'completed' && q.progress < q.target) return { error: 'Quest not finished' };

   if (supabase) {
     await supabase.from('daily_quests').update({ status: 'claimed' }).eq('id', q.id);
   } else {
     await updateOne('daily_quests', row => (row.id === q.id || row.row_id === q.id), { status: 'claimed' });
   }

   await awardXp(userId, q.xp_reward, 'Quest Claim');

   let todayQuests = [];
   if (supabase) {
     const { data } = await supabase.from('daily_quests').select('*').eq('user_id', userId).eq('category', q.category).gt('expires_at', nowIso());
     todayQuests = data || [];
   } else {
     todayQuests = await findAll('daily_quests', x => x.user_id === userId && x.category === q.category && new Date(x.expires_at) > new Date());
   }
   
   if (todayQuests.length > 0) {
      const allClaimed = todayQuests.every(x => x.status === 'claimed');
      if (allClaimed && todayQuests.length >= 3) {
         await awardXp(userId, 50, 'Daily Quests Complete Bonus');
         let shieldData = null;
         if (supabase) {
           const { data } = await supabase.from('streak_shields').select('shields_remaining').eq('user_id', userId).single();
           shieldData = data;
         } else {
           shieldData = await findOne('streak_shields', s => s.user_id === userId);
         }
         
         const count = shieldData ? shieldData.shields_remaining : 0;
         if (supabase) {
           await supabase.from('streak_shields').upsert({ user_id: userId, shields_remaining: count + 1, updated_at: nowIso() });
         } else {
           await upsertOne('streak_shields', s => s.user_id === userId, { user_id: userId, shields_remaining: count + 1, updated_at: nowIso() });
         }
         return { success: true, bonusTriggered: true, xpDelta: q.xp_reward + 50, shieldAwarded: true };
      }
   }

   return { success: true, bonusTriggered: false, xpDelta: q.xp_reward };
}

export async function listLeaderboard`
);

// 7. listLeaderboard
content = content.replace(
  /export async function listLeaderboard\(limit = 100\) \{[\s\S]*/m,
  `export async function listLeaderboard(limit = 100) {
  const users = await readDB('users'); 
  const supabase = getSupabase();
  let lb = [];
  let profs = [];

  if (supabase) {
    const { data: lbData } = await supabase.from('leaderboard').select('*').order('xp_total', { ascending: false }).limit(limit);
    lb = lbData || [];
    const { data: pData } = await supabase.from('gamification_profiles').select('*');
    profs = pData || [];
  } else {
    profs = await findAll('gamification_profiles');
    lb = profs.sort((a, b) => b.xp - a.xp).slice(0, limit).map(p => ({
       user_id: p.user_id,
       xp_total: p.xp,
       rank_name: getRankName(p.xp)
    }));
  }

  return lb.map(entry => {
    const u = users.find(x => x.id === entry.user_id);
    const p = profs.find(x => x.user_id === entry.user_id);
    let fallbackName = 'Student';
    if (entry.user_id && !entry.user_id.includes('-') && entry.user_id !== 'dummy_user') {
       fallbackName = entry.user_id;
    }
    return {
      userId: entry.user_id,
      name: u?.name || fallbackName,
      xp: entry.xp_total,
      level: p?.level || 1,
      streak: p?.streak || 0,
      rank: entry.rank_name,
    };
  });
}
`
);

fs.writeFileSync(file, content);
console.log('Successfully patched gamificationCore.js');
