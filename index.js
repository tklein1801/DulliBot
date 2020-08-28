const Discord = require("discord.js");
const { token, roles, channels, stocks } = require("./config.json");
const roleClaim = require("./role-claim");
const Stocks = require("stocks.js");
const cron = require("cron").CronJob;
const client = new Discord.Client();

function sendError(action, actionByMemberId, error) {
  const errorMsg = new Discord.MessageEmbed()
    .setColor("#fd0061")
    .setTitle("Fehlermeldung")
    .addFields(
      {
        name: "Durchgeführte Aktion",
        value: action,
        inline: true,
      },
      {
        name: "Durchgeführt durch",
        value: `<@${actionByMemberId}>`,
        inline: true,
      },
      {
        name: "Fehlermeldung",
        value: error,
      }
    )
    .setTimestamp()
    .setFooter("by DulliBot", "https://files.dulliag.de/web/images/logo.jpg");
  client.channels.cache.get(channels.botDevelopment).send(errorMsg);
}

function getStocks() {
  let stockChannel = client.channels.cache.find((channel) => channel.id == channels.stocks);
  const stockAPI = new Stocks("SYTCQBUIU44BX2G4");
  stocks.forEach((stock) => {
    new Promise((res, rej) => {
      var result = stockAPI.timeSeries({
        symbol: stock.short,
        interval: "daily",
        amount: 1,
      });
      res(result);
    }).then((data) => {
      let temp = {
        open: data[0].open,
        high: data[0].high,
        low: data[0].low,
        close: data[0].close,
        volume: data[0].volume,
        date: data[0].date,
      };
      const stockMsg = {
        embed: {
          title: `${stock.short} | ${stock.company}`,
          color: 2664261,
          timestamp: new Date(),
          footer: {
            icon_url: "https://files.dulliag.de/web/images/logo.jpg",
            text: "by DulliBot & Stocks.JS",
          },
          fields: [
            {
              name: "Details",
              value: `:clock330: Eröffnet: ${temp.open} $\n:chart_with_upwards_trend: Hoch: ${temp.high} $\n:chart_with_downwards_trend: Tief: ${temp.low} $\n:clock10: Geschlossen: ${temp.close} $`,
            },
          ],
        },
      };
      stockChannel.send(stockMsg);
    });
  });
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  roleClaim(client); // TODO Create an own custom solution for this feature
  var job = new cron("0 1 22 * * 0-5", function () {
    getStocks();
  });
  job.start();
});

client.on("guildMemberAdd", (member) => {
  client.channels.cache
    .get(channels.stats.member)
    .setName(`Mitglieder: ${member.guild.members.cache.filter((m) => !m.user.bot).size}`);
  client.channels.cache
    .get(channels.stats.bots)
    .setName(`Bots: ${member.guild.members.cache.filter((m) => m.user.bot).size}`);

  var role = member.guild.roles.cache.find((role) => role.id == roles.guest);
  var welcomeChannel = client.channels.cache.find((channel) => channel.id == channels.welcome);
  member.roles
    .add(role)
    .then(() => {
      const welcomeMsg = {
        embed: {
          title: `Willkommen ${member.user.username},`,
          description: `wir heißen dich auf dem Discord-Server der DulliAG herzlich willkommen. Für mehr Informationen über die DulliAG besuche doch unsere [Webseite](https://dulliag.de) und am besten schaust du dir mal unsere allgemeines Verhaltensregeln an.`,
          color: 2664261,
          timestamp: new Date(),
          footer: {
            icon_url: "https://files.dulliag.de/web/images/logo.jpg",
            text: "by DulliBot",
          },
          author: {
            name: member.user.username,
            icon_url: member.avatarURL,
          },
        },
      };
      member.send(welcomeMsg);
      welcomeChannel.send(welcomeMsg);
    })
    .catch((err) => {
      sendError("Willkommensnachricht schicken", err);
    });
});

client.on("guildMemberRemove", (member) => {
  client.channels.cache
    .get(channels.stats.member)
    .setName(`Mitglieder: ${member.guild.members.cache.filter((m) => !m.user.bot).size}`);
  client.channels.cache
    .get(channels.stats.bots)
    .setName(`Bots: ${member.guild.members.cache.filter((m) => m.user.bot).size}`);
});

client.on("message", (msg) => {
  // Only for messages written by an user
  if (msg.author.bot == false) {
    if (msg.content.includes("!ban")) {
      // We only search for the Gründer-role bcause this should be the only role/groupd who should be allowed to ban member
      var target = msg.mentions.users.first();
      if (msg.member.roles.cache.has(roles.gruender)) {
        if (target) {
          target = msg.guild.members.cache.get(target.id);
          target.ban();
          msg.reply(`der Benutzer **${target.user.username}** wurde **permanent gebannt**!`);
          // TODO Send an notification-message to the banned player
          // TODO Send an log-message to the log-channel
        } else {
          msg.reply("der Benutzer existiert nicht!");
        }
      } else {
        msg.reply("hat keine Rechte um zu bannen!");
        sendError(msg.content, msg.author.id, `DulliBot: Hat versucht <@${target.id}> zu bannen!`);
      }
    } else if (msg.content.includes("!kick")) {
      var target = msg.mentions.users.first();
      if (msg.member.roles.cache.has(roles.gruender)) {
        if (target) {
          target = msg.guild.members.cache.get(target.id);
          target.kick();
          msg.reply(`der Benutzer **${target.user.username}** wurde **gekickt**!`);
          // TODO Send an notification-message to the kicked player
          // TODO Send an log-message to the log-channel
        } else {
          msg.reply("der Benutzer existiert nicht!");
        }
      } else {
        msg.reply("hat keine Rechte um zu kicken!");
        sendError(msg.content, msg.author.id, `DulliBot: Hat versucht <@${target.id}> zu kicken!`);
      }
    } else if (msg.content == "!clear") {
      if (msg.member.roles.cache.has(roles.gruender) || msg.member.roles.cache.has(roles.coding)) {
        msg.channel.messages.fetch().then((messages) => {
          msg.channel
            .bulkDelete(messages)
            .then(() => {
              msg.reply("hat den Kanal aufgeräumt");
            })
            .catch((err) => {
              msg.reply(
                "der Befehl konnte nicht ausgeführt werden. Ein Fehlerbericht wurde erstellt!"
              );
              sendError(msg.content, msg.author.id, err);
            });
        });
      } else {
        msg.reply("hat keine Rechte zum aufräumen des Kanals!");
      }
    } else if (msg.content == "!stocks") {
      getStocks();
    } else if (msg.content.substring(0, 1) == "!") {
      // Send an message with an command-list
      // TODO Select command-list from command.json
      const errorMsg = new Discord.MessageEmbed()
        .setColor("#fd0061")
        .setTitle("Befehlsliste")
        .addFields(
          {
            name: "Versuchter Befehl",
            value: `${msg.content}`,
          },
          {
            name: "Registrierte Befehle",
            value: `!clear | Kanalnachrichten leeren\n!ban | Mitglied bannen\n!kick | Mitglied kicken\n!stocks | Aktienkurse abrufen`,
          }
        )
        .setTimestamp()
        .setFooter("by DulliBot", "https://files.dulliag.de/web/images/logo.jpg");
      client.channels.cache.get(msg.channel.id).send(errorMsg);
    }
  }
});

client.login(token);
