require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!DISCORD_TOKEN || !CHANNEL_ID) {
  console.error('DISCORD_TOKEN or CHANNEL_ID is missing in your environment variables.');
  process.exit(1);
}

const skills = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic", 
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting", 
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Runecrafting"
];

const players = {
  "Hunhae": { url: "https://2004.lostcity.rs/hiscores/player/hunhae", xp: {} },
  "Bend0ver": { url: "https://2004.lostcity.rs/hiscores/player/Bend0ver", xp: {} },
  "Levinite": { url: "https://2004.lostcity.rs/hiscores/player/levinite", xp: {} }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let firstRun = true;

async function fetchPlayerXP(playerName) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(players[playerName].url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table');

    const xpData = await page.evaluate((skillsList) => {
      const rows = document.querySelectorAll('tr');
      const xpResults = {};

      for (const row of rows) {
        const columns = row.querySelectorAll('td');
        if (columns.length >= 6) {
          const skillName = columns[2].textContent.trim();
          if (skillsList.includes(skillName)) {
            xpResults[skillName] = parseInt(columns[5].textContent.replace(/,/g, ''), 10);
          }
        }
      }
      return xpResults;
    }, skills);

    await browser.close();
    return xpData;
  } catch (error) {
    console.error(`Error fetching XP for ${playerName}: ${error.message}`);
    return null;
  }
}

async function checkPlayers() {
  for (const playerName in players) {
    const currentXP = await fetchPlayerXP(playerName);

    if (currentXP) {
      if (firstRun) {
        players[playerName].xp = currentXP;
      } else {
        for (const skill of skills) {
          const oldXP = players[playerName].xp[skill] || 0;
          const newXP = currentXP[skill] || 0;
          if (newXP > oldXP) {
            players[playerName].xp[skill] = newXP;
            try {
              const channel = await client.channels.fetch(CHANNEL_ID);
              if (channel) {
                await channel.send(`✅ **${playerName} is online!**`);
              }
              break; // Prevent multiple messages per check
            } catch (err) {
              console.error(`Error sending message for ${playerName}:`, err.message);
            }
          }
        }
      }
    }
  }

  if (firstRun) {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) {
        await channel.send("🛰️ **Scout System Online** - Now tracking players.");
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
