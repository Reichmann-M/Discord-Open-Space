const Discord = require('discord.js')
const bot = new Discord.Client();
const fs = require('fs')
const util = require('util')
const config = JSON.parse(fs.readFileSync('config.json'))
const BOTOWNID = config.bot_id;
var oMGC = JSON.parse(fs.readFileSync('managedGuildChannels.json'))
const messages = JSON.parse(fs.readFileSync('messages.json'))

bot.on("ready", function () {
    console.log(`Logged in as ${bot.user.username}`)
})

bot.on("voiceStateUpdate", function (oldState, newState) {
    oMGC.guilds.forEach(managedGuild => {
        managedGuild.baseChannels.every(baseChannel => {

            // Connects to base channel
            if (newState.channelID == baseChannel.id) {
                console.log('[*] user connected to a watched channel ' + baseChannel.id)

                // Create new derivated channel by cloning base channel
                if (baseChannel.derivatedChannels.length == 0) {
                    console.log('Try: Creating derivated channel...')
                    const sDerivatedChannelName = baseChannel.name + ' 2'

                    // Check for already existing channels with same name and parent
                    const oBaseChannelGuild = bot.guilds.cache.get(managedGuild.id)
                    var bChannelAlreadyExists = false;
                    oBaseChannelGuild.channels.cache.every(guildChannel => {
                        if (guildChannel.parentID == baseChannel.parentID && guildChannel.name == sDerivatedChannelName) {
                            bChannelAlreadyExists = true;
                            return false
                        }
                        return true
                    });
                    if (bChannelAlreadyExists) {
                        return console.log('Error: channel already exists')
                    }

                    const oBaseChannel = bot.channels.cache.get(baseChannel.id)
                    oBaseChannelGuild.channels.create(sDerivatedChannelName, {
                        type: 'voice',
                        parent: oBaseChannel.parent,
                        bitrate: oBaseChannel.bitrate,
                        position: oBaseChannel.position + 3,
                        reason: baseChannel.id + messages.ChannelCreationReason
                    })
                }
            } else {
                // User left base channel
                if (oldState.channelID == baseChannel.id) {
                    //TODO: user leaves base channel

                    var oGuildVoiceStates = bot.guilds.cache.get(managedGuild.id).voiceStates.cache
                    var bUsersInBaseChannel = false;
                    var bUsersInDChannel = false;
                    oGuildVoiceStates.every(voiceState => {
                        if (voiceState.channelID == baseChannel.id) {
                            bUsersInBaseChannel = true
                        }
                        baseChannel.derivatedChannels.every(dChannel => {
                            if (voiceState.channelID == dChannel.id) {
                                bUsersInDChannel = true
                                return false
                            }
                            return true
                        })
                        if (bUsersInBaseChannel && bUsersInDChannel) {
                            return false
                        }
                        return true
                    })

                    if (!bUsersInBaseChannel && !bUsersInDChannel) {
                        baseChannel.derivatedChannels.every(dChannel => {
                            bot.channels.cache.get(dChannel.id).delete({reason: messages.ChannelDeleteReason}).then().catch(console.error)
                            console.log('Success: Deleted derivated channel ' + dChannel.id)
                            return true
                        })
                        baseChannel.derivatedChannels = []
                    }


                } else {
                    if (baseChannel.derivatedChannels.length > 0) {
                        baseChannel.derivatedChannels.every(dChannel => {
                            // User left derivated channel
                            if (oldState.channelID == dChannel.id) {
                                var oGuildVoiceStates = bot.guilds.cache.get(managedGuild.id).voiceStates.cache
                                var bUsersInBaseChannel = false;
                                var bUsersInDChannel = false;
                                oGuildVoiceStates.every(voiceState => {
                                    if (voiceState.channelID == baseChannel.id) {
                                        bUsersInBaseChannel = true
                                    }
                                    if (voiceState.channelID == dChannel.id) {
                                        bUsersInDChannel = true
                                        return false
                                    }
                                    return true
                                })
                                if (!bUsersInBaseChannel && !bUsersInDChannel) {
                                    bot.channels.cache.get(dChannel.id).delete({reason: messages.ChannelDeleteReason}).then().catch(console.error)
                                    baseChannel.derivatedChannels = []
                                    console.log('Success: Deleted derivated channel ' + dChannel.id)
                                }
                            }
                            return true;
                        })
                    }

                }
            }
            return true
        });
    });
})

bot.on("channelCreate", async function (createdChannel) {
    const oCreatedChannelGuild = bot.guilds.cache.get(createdChannel.guild.id);
    var baseChannelID = '';

    // Check for audit logs entries executed by bot
    const guildAuditLog = await oCreatedChannelGuild.fetchAuditLogs({
        limit: 10
    })
    guildAuditLog.entries.every(entry => {
        if (entry.executor.id == BOTOWNID) {
            if (entry.target.id == createdChannel.id && entry.action == 'CHANNEL_CREATE' && entry.reason.includes(messages.ChannelCreationReason)) {
                baseChannelID = entry.reason.slice(0, 18)
                console.log("Success: Created derivated channel: " + createdChannel.id + ' of basechannel ' + baseChannelID)
                return false;
            }
        }
        return true
    })

    // Update managed guild channels
    oMGC.guilds.every(managedGuild => {
        if (managedGuild.id == createdChannel.guild.id) {
            managedGuild.baseChannels.every(baseChannel => {
                if (baseChannel.id == baseChannelID) {
                    baseChannel.derivatedChannels.push({
                        name: createdChannel.name,
                        id: createdChannel.id
                    })
                    return false
                }
                return true
            })
            return false
        }
        return true
    })
})

bot.login(config.token)