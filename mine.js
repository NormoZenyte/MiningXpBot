require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const RUNITE_ROLE_ID = '1341564029591748671'; // The role ID for runite rock

if (!DISCORD_TOKEN || !CHANNEL_ID) {
  console.error('DISCORD_TOKEN or CHANNEL_ID is missing in your environment variables.');
  process.exit(1);
}

const players = {
  "Hunhae": { url: "https://2004.lostcity.rs/hiscores/player/hunhae", xp: 0 },
  "Levinite": { url: "https://2004.lostcity.rs/hiscores/player/levinite", xp: 0 }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let firstRun = true;

async function fetchMiningXP(playerName) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(players[playerName].url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table');

    const xpValue = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        const columns = row.querySelectorAll('td');
        if (columns.length >= 6 && columns[2].textContent.trim() === 'Mining') {
          return parseInt(columns[5].textContent.replace(/,/g, ''), 10);
        }
      }
      return null;
    });

    await browser.close();
    return xpValue !== null ? xpValue : null;
  } catch (error) {
    console.error(`Error fetching XP for ${playerName}:`, error.message);
    return null;
  }
}

async function checkPlayers() {
  for (const playerName in players) {
    const currentXP = await fetchMiningXP(playerName);
    if (currentXP !== null) {
      if (firstRun) {
        players[playerName].xp = currentXP;
      } else if (currentXP > players[playerName].xp) {
        const oldXP = players[playerName].xp;
        players[playerName].xp = currentXP;
        const xpGained = currentXP - oldXP;

        try {
          const channel = await client.channels.fetch(CHANNEL_ID);
          if (channel) {
            await channel.send(`⚒️ **${playerName}** has gained Mining XP! New XP: ${currentXP} (Gained: ${xpGained})`);

            if (xpGained % 125 === 0) {
              await channel.send(`⚠️ **${playerName}** is possibly mining runite ore! <@&${RUNITE_ROLE_ID}>`);
            }
          }
        } catch (err) {
          console.error(`Error sending message for ${playerName}:`, err.message);
        }
      }
    }
  }

  if (firstRun) {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) {
        await channel.send("🛰️ **Scout System Online** - Now tracking Mining XP.");
      }
    } catch (err) {
      console.error("Error sending startup message:", err.message);
    }
    firstRun = false;
  }
}

client.once('ready', () => {
  checkPlayers();
  setInterval(checkPlayers, 60000);
});

client.login(DISCORD_TOKEN);
