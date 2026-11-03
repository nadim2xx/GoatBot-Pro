const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const moment = require("moment-timezone");

const AUTHOR = Buffer.from("Uk9DS1kgQ2hvd2RodXJ5", "base64").toString();

function authorOk() {
  return module.exports.config && module.exports.config.author === AUTHOR;
}

const LOCK_MSG =
`🔒━━━━━━━━━━━🔒
⛔ 𝗔𝘂𝘁𝗵𝗼𝗿 𝗟𝗼𝗰𝗸 ⛔
🔒━━━━━━━━━━━🔒
🙈 𝗔𝘂𝘁𝗵𝗼𝗿 𝗰𝗵𝗮𝗻𝗴𝗲𝗱! 𝗧𝗵𝗶𝘀 𝗳𝗶𝗹𝗲 𝘄𝗼𝗻'𝘁 𝘄𝗼𝗿𝗸 💔
👑 𝗢𝗿𝗶𝗴𝗶𝗻𝗮𝗹 𝗮𝘂𝘁𝗵𝗼𝗿 ➜ ${AUTHOR}`;

const VIDEO_URLS = [
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4",
  "https://i.imgur.com/dcJ6kIH.mp4"
];

const CACHE_DIR = path.join(__dirname, "cache", "prefix_videos");

let queue = [];
let lastUrl = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextUrl() {
  if (queue.length === 0) {
    queue = shuffle(VIDEO_URLS);
    if (queue.length > 1 && queue[0] === lastUrl) {
      queue.push(queue.shift());
    }
  }
  const url = queue.shift();
  lastUrl = url;
  return url;
}

async function downloadVideo(url) {
  await fs.ensureDir(CACHE_DIR);
  const file = path.join(CACHE_DIR, path.basename(url));

  if (await fs.pathExists(file)) {
    const stat = await fs.stat(file);
    if (stat.size > 10000) return file;
    await fs.remove(file);
  }

  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 40000,
    maxContentLength: 50 * 1024 * 1024,
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://imgur.com/"
    }
  });
  await fs.writeFile(file, Buffer.from(res.data));
  return file;
}

async function getVideo() {
  let lastError = "unknown";
  for (let i = 0; i < VIDEO_URLS.length; i++) {
    const url = nextUrl();
    try {
      const file = await downloadVideo(url);
      return { stream: fs.createReadStream(file) };
    } catch (e) {
      lastError = e.response?.status ? `HTTP ${e.response.status}` : e.code || e.message;
      console.log("[prefix] video failed:", url, lastError);
    }
  }
  return { error: lastError };
}

module.exports = {
  config: {
    name: "prefix",
    version: "3.4",
    author: "ROCKY Chowdhury",
    countDown: 5,
    role: 0,
    description: "Show and change the bot prefix (chat or global)",
    category: "⚙️ Configuration"
  },

  onStart: async function ({ message, role, args, commandName, event, threadsData }) {
    if (!authorOk()) return message.reply(LOCK_MSG);

    if (!args[0]) return message.SyntaxError();

    if (args[0] === "reset") {
      await threadsData.set(event.threadID, null, "data.prefix");
      return message.reply(
`🎀━━━━━━━━━━━🎀
🌸 𝗣𝗿𝗲𝗳𝗶𝘅 𝗥𝗲𝘀𝗲𝘁 🌸
🎀━━━━━━━━━━━🎀
✨ 𝗗𝗼𝗻𝗲 𝗯𝗮𝗯𝘆! 💖
🍓 𝗗𝗲𝗳𝗮𝘂𝗹𝘁 ➜ ${global.GoatBot.config.prefix}`
      );
    }

    const newPrefix = args[0];
    const setGlobal = args[1] === "-g";

    if (setGlobal && role < 2)
      return message.reply(
`⛔ 𝗢𝗼𝗽𝘀 𝗯𝗮𝗯𝘆! 🙈
🔒 𝗢𝗻𝗹𝘆 𝗯𝗼𝘁 𝗮𝗱𝗺𝗶𝗻𝘀 𝗰𝗮𝗻 𝗰𝗵𝗮𝗻𝗴𝗲 𝗴𝗹𝗼𝗯𝗮𝗹 𝗽𝗿𝗲𝗳𝗶𝘅 🎀`
      );

    return message.reply(
      setGlobal
        ? `🎀━━━━━━━━━━━🎀
🌍 𝗚𝗹𝗼𝗯𝗮𝗹 𝗣𝗿𝗲𝗳𝗶𝘅 🌍
🎀━━━━━━━━━━━🎀
🍭 𝗡𝗲𝘄 ➜ ${newPrefix}
💌 𝗥𝗲𝗮𝗰𝘁 𝘁𝗼 𝗰𝗼𝗻𝗳𝗶𝗿𝗺 ✨`
        : `🎀━━━━━━━━━━━🎀
💬 𝗖𝗵𝗮𝘁 𝗣𝗿𝗲𝗳𝗶𝘅 💬
🎀━━━━━━━━━━━🎀
🍭 𝗡𝗲𝘄 ➜ ${newPrefix}
💌 𝗥𝗲𝗮𝗰𝘁 𝘁𝗼 𝗰𝗼𝗻𝗳𝗶𝗿𝗺 ✨`,
      (err, info) => {
        if (err) return console.log("[prefix] reply error:", err);
        global.GoatBot.onReaction.set(info.messageID, {
          commandName,
          author: event.senderID,
          newPrefix,
          setGlobal,
          messageID: info.messageID
        });
      }
    );
  },

  onReaction: async function ({ message, threadsData, event, Reaction }) {
    try {
      if (!authorOk()) return message.reply(LOCK_MSG);

      const { author, newPrefix, setGlobal } = Reaction;
      if (event.userID !== author) return;

      if (setGlobal) {
        global.GoatBot.config.prefix = newPrefix;
        fs.writeFileSync(
          global.client.dirConfig,
          JSON.stringify(global.GoatBot.config, null, 2)
        );
        return message.reply(
`🎀━━━━━━━━━━━🎀
🌍 𝗣𝗿𝗲𝗳𝗶𝘅 𝗨𝗽𝗱𝗮𝘁𝗲𝗱 🌍
🎀━━━━━━━━━━━🎀
✅ 𝗚𝗹𝗼𝗯𝗮𝗹 ➜ ${newPrefix}
🧸 𝗘𝗻𝗷𝗼𝘆 𝗯𝗮𝗯𝘆 ✨`
        );
      }

      await threadsData.set(event.threadID, newPrefix, "data.prefix");
      return message.reply(
`🎀━━━━━━━━━━━🎀
💬 𝗣𝗿𝗲𝗳𝗶𝘅 𝗨𝗽𝗱𝗮𝘁𝗲𝗱 💬
🎀━━━━━━━━━━━🎀
✅ 𝗖𝗵𝗮𝘁 ➜ ${newPrefix}
🧸 𝗘𝗻𝗷𝗼𝘆 𝗯𝗮𝗯𝘆 ✨`
      );
    } catch (err) {
      console.log("[prefix] onReaction error:", err);
    }
  },

  onChat: async function ({ event, message, threadsData }) {
    try {
      if (!event.body || event.body.trim().toLowerCase() !== "prefix") return;

      if (!authorOk()) return message.reply(LOCK_MSG);

      const globalPrefix = global.GoatBot.config.prefix;
      const threadPrefix =
        (await threadsData.get(event.threadID, "data.prefix")) || globalPrefix;

      const currentTime = moment().tz("Asia/Dhaka").format("hh:mm A");

      const total = Math.floor(process.uptime());
      const hr = Math.floor(total / 3600);
      const min = Math.floor((total % 3600) / 60);
      const sec = total % 60;
      const uptime = `${hr}h ${min}m ${sec}s`;

      const body =
`🎀━━━━━━━━━━━🎀
🌸 𝗣𝗥𝗘𝗙𝗜𝗫 𝗜𝗡𝗙𝗢 🌸
🎀━━━━━━━━━━━🎀
🌍 𝗚𝗹𝗼𝗯𝗮𝗹 ➜ ${globalPrefix}
💬 𝗖𝗵𝗮𝘁 ➜ ${threadPrefix}
📖 𝗛𝗲𝗹𝗽 ➜ ${threadPrefix}help
⏰ 𝗧𝗶𝗺𝗲 ➜ ${currentTime}
⏳ 𝗨𝗽𝘁𝗶𝗺𝗲 ➜ ${uptime}
🆔 𝗜𝗗 ➜ ${event.senderID}
🎀━━━━━━━━━━━🎀
👑 ${AUTHOR.toUpperCase()} 💗`;

      const video = await getVideo();

      if (video.stream) {
        try {
          return await message.reply({ body, attachment: video.stream });
        } catch (e) {
          console.log("[prefix] send with video failed:", e.message || e);
          return message.reply(body);
        }
      }

      return message.reply(body + `\n\n⚠️ 𝗩𝗶𝗱𝗲𝗼 𝗳𝗮𝗶𝗹𝗲𝗱 : ${video.error}`);
    } catch (err) {
      console.log("[prefix] onChat error:", err);
    }
  }
};

if (!authorOk()) {
  throw new Error("[prefix] Author changed! This file is locked to: " + AUTHOR);
		}
