console.log('works')


const Discord = require('discord.js')
const bot = new Discord.Client();
const fs = require('fs')
const util = require('util')
const config = JSON.parse(fs.readFileSync('config.json'))
var MGC = JSON.parse(fs.readFileSync('managedGuildChannels.json'))

bot.on("ready", function() {
    console.log(`Logged in as ${bot.user.username}`)
})

bot.login(config.token)