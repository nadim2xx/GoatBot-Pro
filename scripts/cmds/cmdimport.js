
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");

const MAX_FILES = 50;
const MAX_SIZE = 300000;

module.exports = {
  config: {
    name: "cmdimport",
    aliases: ["importcmd", "cmdsimport"],
    version: "3.0",
    author: "NADIM",
    countDown: 15,
    role: 2,
    description: "Import missing commands from GitHub",
    category: "owner",
    guide: "{pn} <GitHub repository link>"
  },

  onStart: async function ({ message, args }) {
    const link = args[0];

    if (!link) {
      return message.reply(
        "❌ Give a GitHub repository link!\n\n" +
        "/cmdimport https://github.com/user/repo"
      );
    }

    const match = link.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/i
    );

    if (!match) {
      return message.reply("❌ Invalid GitHub link!");
    }

    const owner = match[1];
    const repo = match[2];

    const headers = {
      "User-Agent": "NADIM-CMD-IMPORTER",
      Accept: "application/vnd.github+json"
    };

    const commandDir = __dirname;
    const imported = [];
    const skipped = [];
    const failed = [];

    try {
      await message.reply("🔍 Scanning GitHub repository...");

      const repoInfo = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers, timeout: 20000 }
      );

      const branch = repoInfo.data.default_branch;

      const tree = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers, timeout: 30000 }
      );

      if (tree.data.truncated) {
        return message.reply("❌ Repository tree is too large!");
      }

      const files = tree.data.tree.filter(file => {
        const parts = file.path.split("/");

        return (
          file.type === "blob" &&
          parts.length === 3 &&
          parts[0] === "scripts" &&
          parts[1] === "cmds" &&
          /^[a-zA-Z0-9_.-]+\.js$/i.test(parts[2])
        );
      });

      if (!files.length) {
        return message.reply(
          "❌ No commands found in scripts/cmds/"
        );
      }

      if (files.length > MAX_FILES) {
        return message.reply(
          `❌ Found ${files.length} commands. Maximum is ${MAX_FILES}.`
        );
      }

      const localFiles = await fs.readdir(commandDir);

      const existing = new Set(
        localFiles.map(file => file.toLowerCase())
      );

      const missing = files.filter(file =>
        !existing.has(path.basename(file.path).toLowerCase())
      );

      if (!missing.length) {
        return message.reply(
          "✅ Your bot already has all these commands!"
        );
      }

      for (const file of missing) {
        const filename = path.basename(file.path);

        try {
          const url =
            `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${file.path}`;

          const response = await axios.get(url, {
            headers,
            timeout: 20000,
            responseType: "text",
            maxContentLength: MAX_SIZE
          });

          const code = response.data;

          if (
            typeof code !== "string" ||
            Buffer.byteLength(code, "utf8") > MAX_SIZE ||
            !code.includes("module.exports")
          ) {
            skipped.push(filename);
            continue;
          }

          // Syntax check without executing imported code
          new vm.Script(code, { filename });

          const destination = path.join(
            commandDir,
            filename
          );

          // Never overwrite existing files
          if (await fs.pathExists(destination)) {
            skipped.push(filename);
            continue;
          }

          // Stage for manual review, not automatic execution
          const reviewDir = path.join(
            commandDir,
            "_review_imports"
          );

          await fs.ensureDir(reviewDir);

          await fs.writeFile(
            path.join(reviewDir, filename),
            code,
            { encoding: "utf8", flag: "wx" }
          );

          imported.push(filename);

        } catch (error) {
          failed.push(filename);
          console.error(filename, error.message);
        }
      }

      let report =
        "╭━━━〔 NADIM CMD IMPORTER 〕━━━╮\n\n" +
        `📦 Fork: ${owner}/${repo}\n` +
        `🔎 Found: ${files.length}\n` +
        `📥 Missing: ${missing.length}\n` +
        `✅ Imported for review: ${imported.length}\n` +
        `⚠️ Skipped: ${skipped.length}\n` +
        `❌ Failed: ${failed.length}\n\n`;

      if (imported.length) {
        report +=
          "━━ NEW COMMANDS ━━\n" +
          imported.slice(0, 25).join("\n") +
          "\n\n";
      }

      report +=
        "📂 Location: scripts/cmds/_review_imports/\n" +
        "🔐 Review files before moving them into scripts/cmds/.\n" +
        "╰━━━━━━━━━━━━━━━━━━━━━━━━╯";

      return message.reply(report);

    } catch (error) {
      console.error("CMD IMPORT ERROR:", error);

      return message.reply(
        "❌ GitHub Import Failed!\n" +
        (error.response?.status === 404
          ? "Repository not found or branch unavailable."
          : error.response?.status === 403
          ? "GitHub API rate limit reached."
          : error.message)
      );
    }
  }
};
