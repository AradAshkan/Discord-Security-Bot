const { Client, IntentsBitField, PermissionsBitField, AuditLogEvent } = require('discord.js');
const fs = require('fs');

// Load configuration from config.json
let config;
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (error) {
  console.error('Error loading config.json:', error);
  process.exit(1);
}

const { botToken, whitelist, rateLimitDelay, logUserId, debounceTime, retryAttempts, retryDelay, ignoredChannelIds } = config;

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.DirectMessages
  ],
});

// In-memory store for states and tracking
const previousStates = {
  channels: new Map(),
  roles: new Map(),
};
const lastUpdateTimes = {
  channels: new Map(),
  roles: new Map(),
};
let isRestoring = false;

// Helper function to delay execution
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to send log to a user's DM
async function sendLog(message) {
  if (!logUserId) return;
  try {
    const logUser = await client.users.fetch(logUserId);
    await logUser.send(message.slice(0, 2000)); // Discord message limit
  } catch (error) {
    console.error('Failed to send log to user:', error);
  }
}

// Helper function to check if an update is debounced
function isDebounced(id, type) {
  const lastUpdate = lastUpdateTimes[type].get(id) || 0;
  const now = Date.now();
  if (now - lastUpdate < debounceTime) {
    return true;
  }
  lastUpdateTimes[type].set(id, now);
  return false;
}

// Helper function to fetch audit log with retries
async function fetchAuditLog(guild, type, targetId, attempts = retryAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const auditLogs = await guild.fetchAuditLogs({ limit: 5, type });
      const entry = auditLogs.entries.find(e => e.target.id === targetId) || auditLogs.entries.first();
      if (entry) return entry;
      await sleep(retryDelay);
    } catch (error) {
      console.error(`Audit log fetch attempt ${i + 1} failed:`, error);
      await sleep(retryDelay);
    }
  }
  return null;
}

// Helper function to save the current state of a channel
function saveChannelState(channel) {
  previousStates.channels.set(channel.id, {
    name: channel.name,
    permissions: channel.permissionOverwrites.cache.map(overwrite => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.toArray(),
      deny: overwrite.deny.toArray(),
    })),
    position: channel.position,
    parentId: channel.parentId,
    topic: channel.topic || null,
    bitrate: channel.bitrate || null,
    userLimit: channel.userLimit || null,
    nsfw: channel.nsfw || false,
  });
}

// Helper function to save the current state of a role
function saveRoleState(role) {
  previousStates.roles.set(role.id, {
    name: role.name,
    permissions: role.permissions.toArray(),
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    position: role.position,
  });
}

// Helper function to restore a channel's state
async function restoreChannelState(channel) {
  if (ignoredChannelIds.includes(channel.id)) {
    const logMessage = `Ignored channel update for: ${channel.name} (in ignoredChannelIds)`;
    console.log(logMessage);
    await sendLog(logMessage);
    return;
  }

  const state = previousStates.channels.get(channel.id);
  if (!state) {
    const logMessage = `No previous state found for channel: ${channel.name}`;
    console.log(logMessage);
    await sendLog(logMessage);
    return;
  }

  try {
    isRestoring = true;
    await channel.edit({
      name: state.name,
      position: state.position,
      parent: state.parentId,
      topic: state.topic,
      bitrate: state.bitrate,
      userLimit: state.userLimit,
      nsfw: state.nsfw,
    });

    await channel.permissionOverwrites.set(
      state.permissions.map(perm => ({
        id: perm.id,
        type: perm.type,
        allow: perm.allow,
        deny: perm.deny,
      }))
    );
    const logMessage = `Restored channel: ${channel.name}`;
    console.log(logMessage);
    await sendLog(logMessage);
    await sleep(rateLimitDelay);
  } catch (error) {
    const logMessage = `Failed to restore channel ${channel.name}: ${error.message}`;
    console.error(logMessage);
    await sendLog(logMessage);
  } finally {
    isRestoring = false;
  }
}

// Helper function to restore a role's state
async function restoreRoleState(role) {
  const state = previousStates.roles.get(role.id);
  if (!state) {
    const logMessage = `No previous state found for role: ${role.name}`;
    console.log(logMessage);
    await sendLog(logMessage);
    return;
  }

  try {
    isRestoring = true;
    await role.edit({
      name: state.name,
      permissions: new PermissionsBitField(state.permissions),
      color: state.color,
      hoist: state.hoist,
      mentionable: state.mentionable,
      position: state.position,
    });
    const logMessage = `Restored role: ${role.name}`;
    console.log(logMessage);
    await sendLog(logMessage);
    await sleep(rateLimitDelay);
  } catch (error) {
    const logMessage = `Failed to restore role ${role.name}: ${error.message}`;
    console.error(logMessage);
    await sendLog(logMessage);
  } finally {
    isRestoring = false;
  }
}

// When the bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
//   await sendLog(`Bot started and logged in as ${client.user.tag} (ID: ${client.user.id})`);
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.forEach(channel => saveChannelState(channel));
    guild.roles.cache.forEach(role => saveRoleState(role));
  });
});

// Track channel updates and revert if not whitelisted
client.on('channelUpdate', async (oldChannel, newChannel) => {
  if (isRestoring || isDebounced(newChannel.id, 'channels')) {
    const logMessage = `Skipped channel update for: ${newChannel.name} (isRestoring: ${isRestoring}, debounced: ${isDebounced(newChannel.id, 'channels')})`;
    console.log(logMessage);
    await sendLog(logMessage);
    return;
  }

  try {
    const lastAudit = await fetchAuditLog(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    const userId = lastAudit?.executorId;

    if (!userId) {
      const logMessage = `No audit log entry found for channel update: ${newChannel.name}`;
      console.log(logMessage);
      await sendLog(logMessage);
      saveChannelState(newChannel);
      return;
    }

    if (userId === client.user.id) {
      const logMessage = `Ignoring self-triggered channel update for: ${newChannel.name} (Bot ID: ${client.user.id})`;
      console.log(logMessage);
      await sendLog(logMessage);
      saveChannelState(newChannel);
      return;
    }

    if (!whitelist.includes(userId)) {
      const logMessage = `Non-whitelisted user ${userId} updated channel ${newChannel.name}. Reverting...`;
      console.log(logMessage);
      await sendLog(logMessage);
      await restoreChannelState(newChannel);
      saveChannelState(newChannel);
    } else {
      const logMessage = `Whitelisted user ${userId} updated channel ${newChannel.name}. Saving new state...`;
      console.log(logMessage);
      await sendLog(logMessage);
      saveChannelState(newChannel);
    }
  } catch (error) {
    const logMessage = `Error handling channel update for ${newChannel.name}: ${error.message}`;
    console.error(logMessage);
    await sendLog(logMessage);
  }
});

// Track role updates and revert if not whitelisted
client.on('roleUpdate', async (oldRole, newRole) => {
  if (isRestoring || isDebounced(newRole.id, 'roles')) {
    const logMessage = `Skipped role update for: ${newRole.name} (isRestoring: ${isRestoring}, debounced: ${isDebounced(newRole.id, 'roles')})`;
    console.log(logMessage);
    await sendLog(logMessage);
    return;
  }

  try {
    const lastAudit = await fetchAuditLog(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    const userId = lastAudit?.executorId;

    if (!userId) {
      const logMessage = `No audit log entry found for role update: ${newRole.name}`;
      console.log(logMessage);
      await sendLog(logMessage);
      saveRoleState(newRole);
      return;
    }

    if (userId === client.user.id) {
      const logMessage = `Ignoring self-triggered role update for: ${newRole.name} (Bot ID: ${client.user.id})`;
      console.log(logMessage);
      await sendLog(logMessage);
      saveRoleState(newRole);
      return;
    }

    if (!whitelist.includes(userId)) {
      const logMessage = `Non-whitelisted user ${userId} updated role ${newRole.name}. Reverting...`;
      console.log(logMessage);
      await sendLog(logMessage);
      await restoreRoleState(newRole);
      saveRoleState(newRole);
    } else {
      const logMessage = `Whitelisted user ${userId} updated role ${newRole.name}. Saving new state...`;
      console.log(logMessage);
      await sendLog(logMessage);
      saveRoleState(newRole);
    }
  } catch (error) {
    const logMessage = `Error handling role update for ${newRole.name}: ${error.message}`;
    console.error(logMessage);
    await sendLog(logMessage);
  }
});

// Track channel creation and save state
client.on('channelCreate', async channel => {
  const logMessage = `New channel created: ${channel.name}`;
  console.log(logMessage);
  await sendLog(logMessage);
  saveChannelState(channel);
});

// Track channel deletion and remove state
client.on('channelDelete', async channel => {
  const logMessage = `Channel deleted: ${channel.name}`;
  console.log(logMessage);
  await sendLog(logMessage);
  previousStates.channels.delete(channel.id);
});

// Track role creation and save state
client.on('roleCreate', async role => {
  const logMessage = `New role created: ${role.name}`;
  console.log(logMessage);
  await sendLog(logMessage);
  saveRoleState(role);
});

// Track role deletion and remove state
client.on('roleDelete', async role => {
  const logMessage = `Role deleted: ${role.name}`;
  console.log(logMessage);
  await sendLog(logMessage);
  previousStates.roles.delete(role.id);
});

// Log in to Discord
client.login(botToken);