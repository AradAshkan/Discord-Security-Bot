# 🛡️ Discord Security Bot 🤖

Welcome to the **Discord Guardian Bot**! This bot is your server's trusty protector, ensuring channels and roles stay exactly how you want them. It monitors updates, reverts unauthorized changes, and keeps a log of everything happening behind the scenes. Built with 💪 Node.js and Discord.js, it’s ready to safeguard your Discord community! 🚀

## 🌟 Features

- **🔄 Auto-Revert Unauthorized Changes**: Reverts channel and role updates made by non-whitelisted users.
- **📜 Audit Log Monitoring**: Tracks changes via Discord’s audit logs to identify who’s making changes.
- **📩 DM Logging**: Sends detailed logs to a specified user for transparency.
- **⏳ Debounce & Rate Limiting**: Prevents spam and respects Discord’s API limits.
- **🛠️ Configurable**: Easy setup with a `config.json` file to customize behavior.
- **🔒 Whitelist Protection**: Only allows trusted users to make permanent changes.

## 🚀 Getting Started

Follow these steps to get your Guardian Bot up and running!

### 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Discord.js** (`npm install discord.js`)
- A Discord bot token (get one from the [Discord Developer Portal](https://discord.com/developers/applications))
- A `config.json` file (see below)

### ⚙️ Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/aradashkan/Discord-Security-Bot.git
   cd discord-guardian-bot
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up `config.json`**:
   Create a `config.json` file in the root directory and fill it with your settings:
   ```json
   {
     "botToken": "YOUR_BOT_TOKEN",
     "whitelist": ["USER_ID_1", "USER_ID_2"],
     "rateLimitDelay": 2000,
     "logUserId": "USER_ID_FOR_LOGS",
     "debounceTime": 5000,
     "retryAttempts": 3,
     "retryDelay": 1000,
     "ignoredChannelIds": ["CHANNEL_ID_1", "CHANNEL_ID_2"]
   }
   ```
   - `botToken`: Your Discord bot token.
   - `whitelist`: Array of user IDs allowed to make changes.
   - `rateLimitDelay`: Delay (ms) to avoid hitting Discord’s rate limits.
   - `logUserId`: User ID to receive logs via DM.
   - `debounceTime`: Minimum time (ms) between handling updates for the same channel/role.
   - `retryAttempts`: Number of retries for fetching audit logs.
   - `retryDelay`: Delay (ms) between retry attempts.
   - `ignoredChannelIds`: Array of channel IDs to ignore for updates.

4. **Run the Bot**:
   ```bash
   node index.js
   ```

## 🎮 Usage

1. **Invite the Bot**: Add the bot to your server with the necessary permissions (Manage Channels, Manage Roles, View Audit Log).
2. **Configure Whitelist**: Add trusted user IDs to the `whitelist` in `config.json`.
3. **Monitor Logs**: The bot will DM the `logUserId` with updates and actions taken.
4. **Relax!** 😎 The bot will automatically revert unauthorized changes to channels and roles.

## 🛠️ How It Works

- **Channel & Role Tracking**: Saves the state of channels and roles when the bot starts or after authorized changes.
- **Audit Log Checks**: Uses Discord’s audit logs to detect who made changes.
- **Revert Logic**: If a non-whitelisted user modifies a channel or role, the bot reverts it to the saved state.
- **Debouncing**: Prevents rapid-fire updates from overwhelming the bot.
- **Logging**: Sends detailed logs to the specified user for transparency.

## 📜 Example Logs

```
Restored channel: #general
Non-whitelisted user 123456789 updated channel #announcements. Reverting...
Whitelisted user 987654321 updated role Moderator. Saving new state...
```

## 🤝 Contributing

Want to make the Guardian Bot even better? Contributions are welcome! 🙌

1. Fork the repo.
2. Create a new branch (`git checkout -b feature/awesome-feature`).
3. Commit your changes (`git commit -m 'Add awesome feature'`).
4. Push to the branch (`git push origin feature/awesome-feature`).
5. Open a Pull Request.

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/AradAshkan/Discord-Security-Bot/blob/main/LICENSE.md) file for details.

## 🌈 Questions?

Got questions or need help? Open an issue or ping me on Discord! Let’s make your server a fortress! 🏰
