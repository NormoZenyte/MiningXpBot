require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!DISCORD_TOKEN || !CHANNEL_ID) {
  console.error('DISCORD_TOKEN or CHANNEL_ID is missing in your environment variables.');
  process.exit(1);
}

const players = {
  "Hunhae": { url: "https://2004.lostcity.rs/hiscores/player/hunhae", xp: {} },
  "Levinite": { url: "https://2004.lostcity.rs/hiscores/player/levinite", xp: {} }
};

const skills = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Runecrafting"
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let firstRun = true;
let onlinePlayers = new Set(); // Track who has already been marked online

async function fetchXP(playerName) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(players[playerName].url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table');

    const xpValues = await page.evaluate((skills) => {
      const rows = document.querySelectorAll('tr');
      let xpData = {};
      rows.forEach(row => {
        const columns = row.querySelectorAll('td');
        if (columns.length >= 6) {
          let skillName = columns[2].textContent.trim();
          if (skills.includes(skillName)) {
            let xp = parseInt(columns[5].textContent.replace(/,/g, ''), 10);
            xpData[skillName] = xp;
          }
        }
      });
      return xpData;
    }, skills);

    await browser.close();
    return xpValues;
  } catch (error) {
    console.error(`Error fetching XP for ${playerName}:`, error.message);
    return null;
  }
}

async function checkPlayers() {
  for (const playerName in players) {
    const currentXP = await fetchXP(playerName);
    if (currentXP !== null) {
      let gainedXP = false;

      for (const skill of skills) {
        if (!(skill in players[playerName].xp)) {
          players[playerName].xp[skill] = currentXP[skill] || 0;
        } else if (currentXP[skill] > players[playerName].xp[skill]) {
          players[playerName].xp[skill] = currentXP[skill];
          gainedXP = true;
        }
      }

      if (gainedXP && !onlinePlayers.has(playerName)) {
        try {
          const channel = await client.channels.fetch(CHANNEL_ID);
          if (channel) {
            await channel.send(`✅ **${playerName} is now online!**`);
            onlinePlayers.add(playerName);
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
        await channel.send("🛰️ **Scout System Online** - Now tracking all skills.");
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
