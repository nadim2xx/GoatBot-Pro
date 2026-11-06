
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");

module.exports = {
  config: {
    name: "cmdimport",
    version: "1.0.0",
    author: "NADIM",
    countDown: 15,
    role: 2,
    shortDescription: "Import missing commands from GitHub",
    longDescription: "Find and stage missing commands from another GitHub fork",
    category: "owner",
    guide: "{prefix}cmdimport <GitHub repository link>"
  },

  onStart: async function ({ message, args }) {
    const link = args[0];

    if (!link) {
      return message.reply(
        "❌ Please provide a GitHub repository link!\n\nExample:\n-cmdimport https://github.com/user/repo.git"
      );
    }

    try {
      const match = link.match(
        /github\.com\/([^\/]+)\/([^\/\.?#]+)/
      );

      if (!match) {
        return message.reply("❌ Invalid GitHub URL!");
      }

      const owner = match[1];
      const repo = match[2].replace(/\.git$/, "");

      const headers = {
        "User-Agent": "NADIM-CMD-IMPORTER"
      };

      message.reply("🔍 Checking GitHub repository...");

      const repoInfo = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers }
      );

      const branch = repoInfo.data.default_branch;

      const treeResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers }
      );

      const remoteFiles = treeResponse.data.tree.filter(file =>
        file.type === "blob" &&
        file.path.startsWith("scripts/cmds/") &&
        file.path.endsWith(".js") &&
        file.path.split("/").length === 3
      );

      if (!remoteFiles.length) {
        return message.reply(
          "❌ No commands found in scripts/cmds/!"
        );
      }

      const localDir = __dirname;
      const importDir = path.join(localDir, "imported");

      await fs.ensureDir(importDir);

      const localFiles = await fs.readdir(localDir);
      const stagedFiles = await fs.readdir(importDir);

      const existing = new Set([
        ...localFiles,
        ...stagedFiles
      ].map(name => name.toLowerCase()));

      const missing = remoteFiles.filter(file =>
        !existing.has(path.basename(file.path).toLowerCase())
      );

      if (!missing.length) {
        return message.reply(
          "✅ All command filenames already exist!\nNo missing CMD found."
        );
      }

      let imported = [];
      let skipped = [];

      for (const file of missing) {
        const filename = path.basename(file.path);

        try {
          const rawURL =
            `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${file.path}`;

          const response = await axios.get(rawURL, {
            headers,
            timeout: 20000,
            responseType: "text",
            maxContentLength: 300000
          });

          const code = response.data;

          if (
            typeof code !== "string" ||
            !code.includes("module.exports")
          ) {
            skipped.push(filename);
            continue;
          }

          // Syntax check only; never execute imported code.
          new vm.Script(code, { filename });

          const destination = path.join(importDir, filename);

          await fs.writeFile(destination, code, "utf8");

          imported.push(filename);
        } catch (err) {
          skipped.push(filename);
        }
      }

      let result =
        "╭━━━〔 CMD IMPORT REPORT 〕━━━╮\n\n" +
        `📦 Repository: ${owner}/${repo}\n` +
        `📁 Found: ${remoteFiles.length}\n` +
        `✅ Staged: ${imported.length}\n` +
        `⚠️ Skipped: ${skipped.length}\n\n`;

      if (imported.length) {
        result +=
          "━━ IMPORTED CMDS ━━\n" +
          imported.slice(0, 25).join("\n") +
          "\n\n";
      }

      if (skipped.length) {
        result +=
          "━━ SKIPPED CMDS ━━\n" +
          skipped.slice(0, 15).join("\n") +
          "\n\n";
      }

      result +=
        "📂 Location: scripts/cmds/imported/\n" +
        "⚠️ Review imported code before activation.\n" +
        "╰━━━━━━━━━━━━━━━━━━╯";

      return message.reply(result);

    } catch (error) {
      console.error(error);

      return message.reply(
        "❌ Import failed!\n" +
        (error.response?.status === 404
          ? "Repository or branch not found."
          : "Check repository access or GitHub API limits.")
      );
    }
  }
};
