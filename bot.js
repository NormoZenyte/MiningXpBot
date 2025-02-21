require('dotenv').config();
console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN);
console.log("CHANNEL_ID:", process.env.CHANNEL_ID);
const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const RUNITE_ROLE_ID = '1341564029591748671';  // The role ID for runite rock

if (!DISCORD_TOKEN || !CHANNEL_ID) {
  console.error('DISCORD_TOKEN or CHANNEL_ID is missing in your environment variables.');
  process.exit(1);
}

// Define the players with their hiscores URLs and stored XP
const players = {
  "Hunhae": {
    url: "https://2004.lostcity.rs/hiscores/player/hunhae",
    xp: 0
  },
  "Levinite": {
    url: "https://2004.lostcity.rs/hiscores/player/levinite",
    xp: 0
  }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Function to wait for a specified delay
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Function to fetch Mining XP using Puppeteer
async function fetchMiningXP(playerName) {
  try {
    // Launch Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the player's hiscore page
    await page.goto(players[playerName].url, { waitUntil: 'domcontentloaded' });

    // Wait for the table containing the player's data to be loaded
    await page.waitForSelector('table');

    // Extract the XP for Mining using Puppeteer’s page.evaluate
    const xpValue = await page.evaluate((player) => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        const columns = row.querySelectorAll('td');
        if (columns.length >= 6) {
          const anchor = columns[2].textContent.trim();  // Checking the Mining row
          if (anchor === 'Mining') {
            const xpCell = columns[5];  // The XP value should be in the 6th <td> element
            if (xpCell) {
              const xp = xpCell.textContent.replace(/,/g, '');  // Remove commas
              return parseInt(xp, 10);  // Convert XP to number
            }
          }
        }
      }
      return null;
    }, playerName);

    await browser.close();

    if (xpValue !== null) {
      return xpValue;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

// Function to check XP for all players and notify if there's an increase
async function checkPlayers() {
  for (const playerName in players) {
    const currentXP = await fetchMiningXP(playerName);
    if (currentXP !== null) {
      if (currentXP > players[playerName].xp) {
        const oldXP = players[playerName].xp;
        players[playerName].xp = currentXP;
        const xpGained = currentXP - oldXP;
        try {
          const channel = await client.channels.fetch(CHANNEL_ID);
          if (!channel) {
            continue;
          }
          // Send the normal message
          await channel.send(`⚒️ **${playerName}** has gained Mining XP! New XP: ${currentXP} (Gained: ${xpGained})`);

          // If the amount of XP gained is divisible by 125, send the extra message with role mention.
          if (xpGained % 125 === 0) {
            await channel.send(`⚠️ **${playerName}** is possibly mining runite ore! <@&${RUNITE_ROLE_ID}>`);
          }
        } catch (err) {
          console.error(`Error sending message for ${playerName}:`, err.message);
        }
      }
    }
  }
}

client.once('ready', () => {
  // Initial check
  checkPlayers();
  // Check every 1 minute (60000 ms)
  setInterval(checkPlayers, 60000);
});

client.login(DISCORD_TOKEN);