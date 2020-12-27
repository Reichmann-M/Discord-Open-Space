const Discord = require('discord.js');
const {
    create
} = require('domain');
const bot = new Discord.Client();
require('dotenv').config();
const fs = require('fs')
const util = require('util')
var oMGC = JSON.parse(fs.readFileSync('managedGuildChannels.json'))
const messages = JSON.parse(fs.readFileSync('messages.json'))
var BOTOWNID = ''

bot.on("ready", function () {
    console.log(`Logged in as ${bot.user.username}`)
    BOTOWNID = bot.user.id
})

// sWChannelID ~ String of Watched Channel ID
bot.on("voiceStateUpdate", (oldState, newState) => {
    oMGC.guilds.forEach(oWGuild => {
        oWGuild.watchedChannelCollections.forEach(aWCollection => {
            aWCollection.channels.forEach(oWChannel => {

                // User joins watched channel:
                if (oldState.channelID != oWChannel.id && newState.channelID == oWChannel.id) {
                    console.log(`[OPEN-SPACE]: + User ${newState.member.user.id} joined channel "${newState.channel.name}" (${newState.channelID})`)

                    // Update user amount in channel json
                    oWChannel.userAmount = oWChannel.userAmount + 1;

                    // Handle Channel
                    manageChannels(aWCollection, oWGuild.id)
                }

                // User leaves watched channel:
                else if (oldState.channelID == oWChannel.id && newState.channelID != oWChannel.id) {
                    console.log(`[OPEN-SPACE]: - User ${newState.member.user.id} left channel "${oldState.channel.name}" (${oldState.channelID})`)

                    // Update user amount in channel json
                    oWChannel.userAmount = oWChannel.userAmount - 1;

                    // Handle Channel
                    manageChannels(aWCollection, oWGuild.id)
                }
            });
        });
    });
})


function manageChannels(currentCollection, currentGuildID) {
    var oCurrentGuild = bot.guilds.cache.get(currentGuildID)

    // Check if one and only one EMPTY channel in this collection exists
    const oneAndOnlyOne = arr => arr.filter(v => v.userAmount == 0).length == 1;
    if (oneAndOnlyOne(currentCollection.channels)) {
        // Do nothing
    } else {
        // Count how many channels with 0 users exists
        var aEmptyChannels = []
        currentCollection.channels.forEach(oWChannel => {
            if (oWChannel.userAmount == 0) {
                aEmptyChannels.push(oWChannel)
            }
        });

        if (aEmptyChannels.length == 0) {
            // Create new empty channel
            const oTemplateChannel = bot.channels.cache.get(currentCollection.channels[0].id)
            oCurrentGuild.channels.create(currentCollection.name, {
                type: 'voice',
                parent: oTemplateChannel.parent,
                bitrate: oTemplateChannel.bitrate,
                reason: currentCollection.id + messages.ChannelCreationReason
            })

        } else {
            // More than one empty channel

            const oPivotChannel = bot.channels.cache.get(aEmptyChannels[0].id)
            oPivotChannel.delete({
                reason: messages.ChannelDeleteReason
            })

            // Delete Channel from collection JSON
            oMGC.guilds.forEach(oWGuild => {
                oWGuild.watchedChannelCollections.forEach(aWCollection => {
                    aWCollection.channels = aWCollection.channels.filter(function (obj) {
                        return obj.id !== aEmptyChannels[0].id;
                    });
                });
            });

            console.log("[OPEN-SPACE] Success: Deleted derivated channel: " + aEmptyChannels[0].id + ' of collection ' + currentCollection.id)

            // Save oMGC in JSON
            fs.writeFileSync('managedGuildChannels.json', JSON.stringify(oMGC))

        }
    }
}

bot.on("channelCreate", async function (createdChannel) {
    const oCreatedChannelGuild = bot.guilds.cache.get(createdChannel.guild.id);
    var foundCollectionID = '';

    // Check for audit logs entries executed by bot
    const guildAuditLog = await oCreatedChannelGuild.fetchAuditLogs({
        limit: 10
    })
    guildAuditLog.entries.every(entry => {
        if (entry.executor.id == BOTOWNID) {
            if (entry.target.id == createdChannel.id && entry.action == 'CHANNEL_CREATE' && entry.reason.includes(messages.ChannelCreationReason)) {
                foundCollectionID = entry.reason.slice(0, 16)
                console.log("[OPEN-SPACE] Success: Created derivated channel: " + createdChannel.id + ' of collection ' + foundCollectionID)

                // Set derivated channel position +
                // Add new channel to collection
                oMGC.guilds.forEach(oWGuild => {
                    oWGuild.watchedChannelCollections.every(aWCollection => {
                        if (aWCollection.id == foundCollectionID) {
                            createdChannel.edit({
                                position: bot.channels.cache.get(aWCollection.channels[aWCollection.channels.length - 1].id).position + 1
                            })
                            aWCollection.channels.push({
                                id: createdChannel.id,
                                userAmount: 0
                            })
                            return false
                        }
                        return true
                    });
                });

                // Save oMGC in JSON
                fs.writeFileSync('managedGuildChannels.json', JSON.stringify(oMGC))

                return false;
            }
        }
        return true
    })


})


bot.login(process.env.DISCORD_BOT_TOKEN)